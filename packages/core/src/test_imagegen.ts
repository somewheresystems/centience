import { imageGeneration } from './actions/imageGeneration';
import { IAgentRuntime } from './core/types';

const mockRuntime: IAgentRuntime = {
    agentId: 'test-agent',
    getSetting: (key: string) => process.env[key],
    composeState: async () => ({ context: [] }),
    // ... add other required runtime methods
};

async function test() {
    const message = {
        content: {
            text: "A cute cat wearing a wizard hat, digital art style"
        }
    };

    await imageGeneration.handler(
        mockRuntime,
        message,
        { context: [] },
        {},
        (response, _) => {
            console.log('Generated response:', response);
        }
    );
}

test().catch(console.error);