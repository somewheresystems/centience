import { Message } from "@telegraf/types";
import { Context, Telegraf } from "telegraf";

import { composeContext } from "../../../core/context.ts";
import { embeddingZeroVector } from "../../../core/memory.ts";
import {
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    UUID,
} from "../../../core/types.ts";
import { stringToUuid } from "../../../core/uuid.ts";

import {
    generateMessageResponse,
    generateShouldRespond,
    generateTrueOrFalse,
} from "../../../core/generation.ts";
import {
    messageCompletionFooter,
    shouldRespondFooter,
} from "../../../core/parsing.ts";
import ImageDescriptionService from "../../../services/image.ts";

const MAX_MESSAGE_LENGTH = 4096; // Telegram's max message length

const telegramShouldRespondTemplate =
    `# Task: Decide if {{agentName}} should respond.
About {{agentName}}:
{{bio}}

# INSTRUCTIONS: Determine if {{agentName}} should respond to the message and participate in the conversation. Do not comment. Just respond with "RESPOND" or "IGNORE" or "STOP".

# RESPONSE EXAMPLES
<user 1>: I just saw a really great movie
<user 2>: Oh? Which movie?
Result: [IGNORE]

{{agentName}}: Oh, this is my favorite scene
<user 1>: sick
<user 2>: wait, why is it your favorite scene
Result: [RESPOND]

<user>: stfu bot
Result: [STOP]

<user>: Hey {{agent}}, can you help me with something
Result: [RESPOND]

<user>: {{agentName}} stfu plz
Result: [STOP]

<user>: i need help
{{agentName}}: how can I help you?
<user>: no. i need help from someone else
Result: [IGNORE]

<user>: Hey {{agent}}, can I ask you a question
{{agentName}}: Sure, what is it
<user>: can you ask claude to create a basic react module that demonstrates a counter
Result: [RESPOND]

<user>: {{agentName}} can you tell me a story
<user>: {about a girl named elara
{{agentName}}: Sure.
{{agentName}}: Once upon a time, in a quaint little village, there was a curious girl named Elara.
{{agentName}}: Elara was known for her adventurous spirit and her knack for finding beauty in the mundane.
<user>: I'm loving it, keep going
Result: [RESPOND]

<user>: {{agentName}} stop responding plz
Result: [STOP]

<user>: okay, i want to test something. can you say marco?
{{agentName}}: marco
<user>: great. okay, now do it again
Result: [RESPOND]

Response options are [RESPOND], [IGNORE] and [STOP].

{{agentName}} is in a room with other users and is very worried about being annoying and saying too much.
Respond with [RESPOND] to messages that are directed at {{agentName}}, or participate in conversations that are interesting or relevant to their background.
If a message is not interesting or relevant, respond with [IGNORE]
Unless directly responding to a user, respond with [IGNORE] to messages that are very short or do not contain much information.
If a user asks {{agentName}} to be quiet, respond with [STOP]
If {{agentName}} concludes a conversation and isn't part of the conversation anymore, respond with [STOP]

IMPORTANT: {{agentName}} is particularly sensitive about being annoying, so if there is any doubt, it is better to respond with [IGNORE].
If {{agentName}} is conversing with a user and they have not asked to stop, it is better to respond with [RESPOND].

{{recentMessages}}

# INSTRUCTIONS: Choose the option that best describes {{agentName}}'s response to the last message. Ignore messages if they are addressed to someone else.
` + shouldRespondFooter;

const telegramMessageHandlerTemplate =
    // {{goals}}
    `# Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Relevant facts that {{agentName}} knows:
{{relevantFacts}}

# Recent facts that {{agentName}} has learned:
{{recentFacts}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Examples of {{agentName}}'s dialog and actions:
{{characterMessageExamples}}

{{providers}}

{{attachments}}

{{actions}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

# Instructions: Write the next message for {{agentName}}. Include an action, if appropriate. {{actionNames}}
` + messageCompletionFooter;

const telegramShouldGenerateImageTemplate = `# Task: Decide if {{agentName}} should generate an image.

# INSTRUCTIONS: Determine if the user is requesting image generation. Respond with "RESPOND", "IGNORE", or "STOP".

# RESPONSE EXAMPLES
<user>: can you generate an image of a cat
Result: RESPOND

<user>: make me a picture of mountains 
Result: RESPOND

<user>: draw me something beautiful
Result: RESPOND

<user>: can you show me what that would look like?
Result: RESPOND

<user>: what do you think about cats?
Result: IGNORE

<user>: hey can you help me with something
Result: IGNORE

<user>: describe a mountain landscape
Result: IGNORE
`;

export class MessageManager {
    private bot: Telegraf<Context>;
    private runtime: IAgentRuntime;
    private imageService: ImageDescriptionService;

    constructor(bot: Telegraf<Context>, runtime: IAgentRuntime) {
        this.bot = bot;
        this.runtime = runtime;
        this.imageService = ImageDescriptionService.getInstance(this.runtime);
    }

    // Process image messages and generate descriptions
    private async processImage(
        message: Message
    ): Promise<{ description: string } | null> {
        // console.log(
        //     "🖼️ Processing image message:",
        //     JSON.stringify(message, null, 2)
        // );

        try {
            let imageUrl: string | null = null;

            // Handle photo messages
            if ("photo" in message && message.photo?.length > 0) {
                const photo = message.photo[message.photo.length - 1];
                const fileLink = await this.bot.telegram.getFileLink(
                    photo.file_id
                );
                imageUrl = fileLink.toString();
            }
            // Handle image documents
            else if (
                "document" in message &&
                message.document?.mime_type?.startsWith("image/")
            ) {
                const doc = message.document;
                const fileLink = await this.bot.telegram.getFileLink(
                    doc.file_id
                );
                imageUrl = fileLink.toString();
            }

            if (imageUrl) {
                const { title, description } =
                    await this.imageService.describeImage(imageUrl);
                const fullDescription = `[Image: ${title}\n${description}]`;
                return { description: fullDescription };
            }
        } catch (error) {
            console.error("❌ Error processing image:", error);
        }

        return null; // No image found
    }

    // Decide if the bot should respond to the message
    private async _shouldRespond(
        message: Message,
        state: State
    ): Promise<boolean> {
        // Respond if bot is mentioned

        if (
            "text" in message &&
            message.text?.includes(`@${this.bot.botInfo?.username}`)
        ) {
            return true;
        }

        // Respond to private chats
        if (message.chat.type === "private") {
            return true;
        }

        // Respond to images in group chats
        if (
            "photo" in message ||
            ("document" in message &&
                message.document?.mime_type?.startsWith("image/"))
        ) {
            return false;
        }

        // Use AI to decide for text or captions
        if ("text" in message || ("caption" in message && message.caption)) {
            const shouldRespondContext = composeContext({
                state,
                template:
                    this.runtime.character.templates
                        ?.telegramShouldRespondTemplate ||
                    this.runtime.character?.templates?.shouldRespondTemplate ||
                    telegramShouldRespondTemplate,
            });

            const response = await generateShouldRespond({
                runtime: this.runtime,
                context: shouldRespondContext,
                modelClass: ModelClass.SMALL,
            });

            return response === "RESPOND";
        }

        return false; // No criteria met
    }

    // Add this method after _shouldRespond
    private async _shouldGenerateImage(text: string, state: State): Promise<boolean> {
        const imageAction = this.runtime.actions.find(
            action => action.name === "GENERATE_IMAGE"
        );
        
        if (!imageAction || !imageAction.validate) {
            return false;
        }

        const memory: Memory = {
            userId: state.userId,
            agentId: this.runtime.agentId,
            roomId: state.roomId,
            content: { text },
            createdAt: Date.now(),
            embedding: embeddingZeroVector,
            id: stringToUuid(Date.now().toString())
        };

        const isValid = await imageAction.validate(this.runtime, memory);
        if (!isValid) {
            return false;
        }

        const shouldGenerateContext = composeContext({
            state,
            template: telegramShouldGenerateImageTemplate,
        });

        const response = await generateShouldRespond({
            runtime: this.runtime,
            context: shouldGenerateContext,
            modelClass: ModelClass.SMALL,
        });

        return response === "RESPOND";
    }

    // Send long messages in chunks
    private async sendWithRetry(
        ctx: Context,
        method: 'sendMessage' | 'sendPhoto',
        params: any,
        maxRetries = 3
    ): Promise<any> {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (method === 'sendMessage') {
                    return await ctx.telegram.sendMessage(params.chat_id, params.text, params.options);
                } else if (method === 'sendPhoto') {
                    return await ctx.telegram.sendPhoto(params.chat_id, params.photo, params.options);
                }
            } catch (error) {
                lastError = error;
                if (error?.response?.error_code === 429) {
                    const retryAfter = error?.response?.parameters?.retry_after || 10;
                    console.log(`Rate limited. Waiting ${retryAfter} seconds before retry ${i + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    private async sendMessageInChunks(
        ctx: Context,
        content: string,
        replyToMessageId?: number
    ): Promise<Message.TextMessage[]> {
        const chunks = this.splitMessage(content);
        const sentMessages: Message.TextMessage[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const sentMessage = await this.sendWithRetry(
                ctx,
                'sendMessage',
                {
                    chat_id: ctx.chat.id,
                    text: chunk,
                    options: {
                        reply_parameters: i === 0 && replyToMessageId
                            ? { message_id: replyToMessageId }
                            : undefined,
                    }
                }
            ) as Message.TextMessage;

            sentMessages.push(sentMessage);
        }

        return sentMessages;
    }

    // Split message into smaller parts
    private splitMessage(text: string): string[] {
        const chunks: string[] = [];
        let currentChunk = "";

        const lines = text.split("\n");
        for (const line of lines) {
            if (currentChunk.length + line.length + 1 <= MAX_MESSAGE_LENGTH) {
                currentChunk += (currentChunk ? "\n" : "") + line;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = line;
            }
        }

        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    }

    // Generate a response using AI
    private async _generateResponse(
        message: Memory,
        state: State,
        context: string
    ): Promise<Content> {
        const { userId, roomId } = message;

        const response = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        if (!response) {
            console.error("❌ No response from generateMessageResponse");
            return null;
        }
        await this.runtime.databaseAdapter.log({
            body: { message, context, response },
            userId: userId,
            roomId,
            type: "response",
        });

        return response;
    }

    // Main handler for incoming messages
    public async handleMessage(ctx: Context): Promise<void> {
        if (!ctx.message || !ctx.from) {
            return; // Exit if no message or sender info
        }

        // TODO: Handle commands?
        // if (ctx.message.text?.startsWith("/")) {
        //     return;
        // }

        const message = ctx.message;

        try {
            // Convert IDs to UUIDs
            const userId = stringToUuid(ctx.from.id.toString()) as UUID;
            const userName =
                ctx.from.username || ctx.from.first_name || "Unknown User";
            const chatId = stringToUuid(
                ctx.chat?.id.toString() + "-" + this.runtime.agentId
            ) as UUID;
            const agentId = this.runtime.agentId;
            const roomId = chatId;

            await this.runtime.ensureConnection(
                userId,
                roomId,
                userName,
                userName,
                "telegram"
            );

            const messageId = stringToUuid(
                message.message_id.toString() + "-" + this.runtime.agentId
            ) as UUID;

            // Handle images
            const imageInfo = await this.processImage(message);

            // Get text or caption
            let messageText = "";
            if ("text" in message) {
                messageText = message.text;
            } else if ("caption" in message && message.caption) {
                messageText = message.caption;
            }

            // Combine text and image description
            const fullText = imageInfo
                ? `${messageText} ${imageInfo.description}`
                : messageText;

            if (!fullText) {
                return; // Skip if no content
            }

            const content: Content = {
                text: fullText,
                source: "telegram",
                inReplyTo:
                    "reply_to_message" in message && message.reply_to_message
                        ? stringToUuid(
                              message.reply_to_message.message_id.toString() +
                                  "-" +
                                  this.runtime.agentId
                          )
                        : undefined,
            };

            // Create memory for the message
            const memory: Memory = {
                id: messageId,
                agentId,
                userId,
                roomId,
                content,
                createdAt: message.date * 1000,
                embedding: embeddingZeroVector,
            };

            await this.runtime.messageManager.createMemory(memory);

            // Update state with the new memory
            let state = await this.runtime.composeState(memory);
            state = await this.runtime.updateRecentMessageState(state);

            // Decide whether to respond
            const shouldRespond = await this._shouldRespond(message, state);
            if (!shouldRespond) return;

            // Define callback first
            const callback: HandlerCallback = async (content: Content) => {
                const sentMessages = await this.sendMessageInChunks(
                    ctx,
                    content.text,
                    message.message_id
                );

                const memories: Memory[] = [];

                // Create memories for each sent message
                for (let i = 0; i < sentMessages.length; i++) {
                    const sentMessage = sentMessages[i];
                    const isLastMessage = i === sentMessages.length - 1;

                    const memory: Memory = {
                        id: stringToUuid(
                            sentMessage.message_id.toString() +
                                "-" +
                                this.runtime.agentId
                        ),
                        agentId,
                        userId,
                        roomId,
                        content: {
                            ...content,
                            text: sentMessage.text,
                            action: !isLastMessage ? "CONTINUE" : undefined,
                            inReplyTo: messageId,
                        },
                        createdAt: sentMessage.date * 1000,
                        embedding: embeddingZeroVector,
                    };

                    await this.runtime.messageManager.createMemory(memory);
                    memories.push(memory);
                }

                return memories;
            };

            // Check for image generation request
            const shouldGenerateImage = await this._shouldGenerateImage(fullText, state);
            if (shouldGenerateImage) {
                const imageAction = this.runtime.actions.find(
                    action => action.name === "GENERATE_IMAGE"
                );
                
                if (imageAction && imageAction.handler) {
                    await imageAction.handler(
                        this.runtime,
                        memory,
                        state,
                        {},
                        async (content: Content, tempFiles: string[] = []) => {
                            try {
                                if (content.text) {
                                    await this.sendMessageInChunks(ctx, content.text, message.message_id);
                                }
                                
                                if (content.files && Array.isArray(content.files) && content.files.length > 0) {
                                    for (const file of content.files) {
                                        await this.sendWithRetry(
                                            ctx,
                                            'sendPhoto',
                                            {
                                                chat_id: ctx.chat.id,
                                                photo: { source: file.attachment },
                                                options: {}
                                            }
                                        );
                                    }
                                }
                            } catch (error) {
                                console.error("Error sending message/image:", error);
                                throw error;
                            }
                            return [];
                        }
                    );
                    return;
                }
            }

            // Generate response
            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates
                        ?.telegramMessageHandlerTemplate ||
                    this.runtime.character?.templates?.messageHandlerTemplate ||
                    telegramMessageHandlerTemplate,
            });

            const responseContent = await this._generateResponse(
                memory,
                state,
                context
            );

            if (!responseContent || !responseContent.text) return;

            // Execute callback to send messages and log memories
            const responseMessages = await callback(responseContent);

            // Update state after response
            state = await this.runtime.updateRecentMessageState(state);
            await this.runtime.evaluate(memory, state);

            // Handle any resulting actions
            await this.runtime.processActions(
                memory,
                responseMessages,
                state,
                callback
            );
        } catch (error) {
            console.error("❌ Error handling message:", error);
            await ctx.reply(
                "Sorry, I encountered an error while processing your request."
            );
        }
    }
}
