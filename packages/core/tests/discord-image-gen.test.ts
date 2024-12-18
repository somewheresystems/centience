import {
    AgentRuntime,
    IAgentRuntime,
    defaultCharacter,
    ImageGenModel,
    Memory,
    UUID
} from "@eliza/core";

describe('Discord Image Generation', () => {
    let runtime: IAgentRuntime;
    
    beforeEach(async () => {
        // Reference the createAgent function from agent package
        // See packages/agent/src/index.ts lines 40-70
        runtime = new AgentRuntime({
            databaseAdapter: null,
            token: process.env.TOGETHER_API_KEY || '',
            modelProvider: defaultCharacter.modelProvider,
            evaluators: [],
            character: defaultCharacter,
            providers: [],
            actions: [imageGeneration],
        });
    });

    test('should generate an image successfully', async () => {
        const message: Memory = {
            userId: 'test-user' as UUID,
            agentId: 'test-agent' as UUID,
            roomId: 'test-room' as UUID,
            content: {
                text: "A beautiful mountain landscape at sunset with dramatic clouds"
            }
        };

        const mockCallback = jest.fn();

        await imageGeneration.handler(
            runtime,
            message,
            { context: [] },
            {},
            mockCallback
        );

        expect(mockCallback).toHaveBeenCalled();
        const callArgs = mockCallback.mock.calls[0];
        expect(callArgs[0]).toHaveProperty('attachments');
        expect(callArgs[0].attachments[0]).toHaveProperty('url');
    }, 30000);
});