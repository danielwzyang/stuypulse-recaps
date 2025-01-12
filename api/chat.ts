import { WebClient } from "@slack/web-api"
import { getGPTResponse, generatePromptFromMessage } from "./openai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

type Event = {
    channel: string
    ts: string
}

export async function sendGPTResponse(event: Event) {
    const { channel, ts } = event

    try {
        const thread = await slack.conversations.replies({ channel, ts })
        if (thread.messages?.length != 1) 
            return

        const messages = await fetchMessages()
        const prompts = await generatePromptFromMessage(messages)
        const gptResponse = await getGPTResponse(prompts)

        await slack.chat.postMessage({
            channel,
            text: gptResponse.choices[0].message.content || `<@${process.env.SLACK_ADMIN_ID}> Error: Response from ChatGPT was empty.`,
            thread_ts: ts,
        })
    } catch (error) {
        if (error instanceof Error) {
            await slack.chat.postMessage({
                channel,
                text: `<@${process.env.SLACK_ADMIN_ID}> Error: ${error.message}`,
                thread_ts: ts,
        })
        }
    }
}

async function fetchMessages() {
    const messages: string[] = []

    const recapChannels = process.env.SLACK_RECAP_CHANNELS?.split(" ") || []

    const midnightEST = dayjs().tz('America/New_York').startOf('day').utc()
    const oldest = String(midnightEST.unix())

    for (let recapChannel of recapChannels) {
        const response = await slack.conversations.history({
            channel: recapChannel,
            oldest,
        })
        
        response.messages?.forEach(message => {
            messages.push(message.text!)
        })
    }

    return messages.join("\n")
}