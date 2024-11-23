import { IAgentRuntime, State, ModelClass } from "../../core/types.js";
import { elizaLogger } from "../../index.js";
import { generateHtml } from "../../core/generation.js"; // Removed unused generateText import
import { composeContext } from "../../core/context.js";
import { diffLines } from "diff";
import { WebsiteMemoryManager } from "./WebsiteMemoryManager.js";

interface HtmlVersion {
    content: string;
    timestamp: string;
}

class HtmlManager {
    private currentHtml: string;
    private versionHistory: HtmlVersion[];
    private lastGenerationTime = 0;
    private minDelayBetweenGenerations = 1000; // 1 second minimum delay
    public readonly maxContinuationAttempts = 10; // Maximum number of continuation attempts
    private websiteId: string;

    constructor(websiteId: string) {
        this.currentHtml = "";
        this.versionHistory = [];
        this.websiteId = websiteId;
        elizaLogger.log("HtmlManager initialized");
    }

    private async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastGeneration = now - this.lastGenerationTime;
        if (timeSinceLastGeneration < this.minDelayBetweenGenerations) {
            const delayNeeded =
                this.minDelayBetweenGenerations - timeSinceLastGeneration;
            elizaLogger.log(`Rate limit enforced - waiting ${delayNeeded}ms`);
            await new Promise((resolve) => setTimeout(resolve, delayNeeded));
        }
        this.lastGenerationTime = Date.now();
        elizaLogger.log("Rate limit check completed");
    }

    generateInitialHtml(content: string): string {
        elizaLogger.log("Starting initial HTML generation");

        // Clean the HTML of any non-HTML text or comments
        const cleanedContent = content
            .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
            .replace(/^[^<]*/g, "") // Remove any text before first tag
            .replace(/[^>]*$/g, "") // Remove any text after last tag
            .replace(/>\s+</g, ">\n<") // Clean up whitespace between tags
            .trim();

        elizaLogger.log("HTML cleaned and formatted", {
            originalLength: content.length,
            cleanedLength: cleanedContent.length,
        });

        this.currentHtml = cleanedContent;
        this.versionHistory.push({
            content: cleanedContent,
            timestamp: new Date().toISOString(),
        });

        elizaLogger.log("Initial HTML version saved to history");
        return cleanedContent;
    }

    async applyContinuation(
        runtime: IAgentRuntime,
        state: State,
        htmlContent: string,
        lastCompleteElement: string,
        partialJsCode: string
    ): Promise<string> {
        elizaLogger.log("Starting HTML continuation", {
            contentLength: htmlContent.length,
            lastElement: lastCompleteElement.substring(0, 50) + "...",
        });

        await this.enforceRateLimit();

        const oldVersion = this.currentHtml;

        // Generate continuation with context about incomplete elements
        elizaLogger.log("Generating continuation with context");
        const continuation = await generateHtml({
            runtime,
            context: composeContext({
                state,
                template: `Complete this truncated HTML content. Start from where it left off, maintaining consistency with the previous content.
                
                Previous content:
                ${htmlContent}
                
                Context:
                - Last complete element: ${lastCompleteElement}
                ${partialJsCode ? `- Incomplete JavaScript code to complete: ${partialJsCode}` : ""}
                
                Requirements:
                1. Continue seamlessly from the last complete element
                2. Complete any truncated HTML elements
                3. Complete any incomplete JavaScript code blocks - provide FULL implementation
                4. Ensure ALL interactive features have complete code implementation
                5. Maintain consistent styling and structure
                6. End with proper </main> tag
                7. Include all necessary closing script tags
                8. Include ALL code in <script> tags - no partial implementations
                9. For games:
                   - Include complete game initialization and state management
                   - Include all game mechanics and event handlers
                   - Ensure canvas setup is complete
                10. For websites:
                    - Include complete interactive feature implementations
                    - Include all event handlers and DOM manipulations
                    - Ensure responsive behaviors are fully coded
                
                Output ONLY the continuation code that will combine with the previous content to form valid HTML.`,
            }),
            modelClass: ModelClass.MEDIUM,
        });

        elizaLogger.log("Continuation generated, cleaning up");

        // Clean up continuation and ensure proper structure
        const cleanedContinuation = continuation
            .replace(/^[^<]*/g, "") // Remove any non-HTML at start
            .replace(/[^>]*$/g, "") // Remove any non-HTML at end
            .replace(/^<main[^>]*>/, "") // Remove any opening main tag
            .replace(/>\s+</g, ">\n<") // Clean up whitespace between tags
            .trim();

        elizaLogger.log("Continuation cleaned", {
            originalLength: continuation.length,
            cleanedLength: cleanedContinuation.length,
        });

        // Combine content, ensuring proper spacing
        let newVersion = htmlContent.trimEnd() + "\n" + cleanedContinuation;

        // Ensure proper closing of main tag
        if (!newVersion.includes("</main>")) {
            elizaLogger.log("Adding missing </main> tag");
            newVersion += "\n</main>";
        }

        // Generate diff for logging
        const diffGenerated = diffLines(oldVersion, newVersion);

        elizaLogger.log("Content diff generated", {
            diffLength: diffGenerated.length,
            addedLines: diffGenerated.filter((part) => part.added).length,
            removedLines: diffGenerated.filter((part) => part.removed).length,
            timestamp: new Date().toISOString(),
            changes: diffGenerated.map((part) => ({
                added: part.added,
                removed: part.removed,
                value: part.value.substring(0, 50) + "...",
            })),
        });

        // Store new version
        this.currentHtml = newVersion;
        this.versionHistory.push({
            content: newVersion,
            timestamp: new Date().toISOString(),
        });

        // Add version to website memory with diff stats
        websiteMemory.addVersion(this.websiteId, newVersion, {
            added: diffGenerated.filter((part) => part.added).length,
            removed: diffGenerated.filter((part) => part.removed).length,
            modified: diffGenerated.length,
        });

        elizaLogger.log("New version saved to history", {
            totalVersions: this.versionHistory.length,
        });

        return this.currentHtml;
    }

    private validateBasicStructure(html: string): boolean {
        elizaLogger.log("Validating basic HTML structure");

        const hasDoctype = html.includes("<!DOCTYPE html>");
        const hasHtmlTag = html.includes("<html") && html.includes("</html>");
        const hasHeadTag = html.includes("<head") && html.includes("</head>");
        const hasBodyTag = html.includes("<body") && html.includes("</body>");
        const hasMainTag = html.includes("<main") && html.includes("</main>");

        elizaLogger.log("Structure validation results", {
            hasDoctype,
            hasHtmlTag,
            hasHeadTag,
            hasBodyTag,
            hasMainTag,
        });

        return (
            hasDoctype && hasHtmlTag && hasHeadTag && hasBodyTag && hasMainTag
        );
    }

    undoLastEdit(): string | null {
        elizaLogger.log("Attempting to undo last edit", {
            totalVersions: this.versionHistory.length,
        });

        if (this.versionHistory.length < 2) {
            elizaLogger.warn("Cannot undo - insufficient version history");
            return null;
        }

        const removedVersion = this.versionHistory.pop();
        const previousVersion =
            this.versionHistory[this.versionHistory.length - 1];
        this.currentHtml = previousVersion.content;

        elizaLogger.log("Undo successful", {
            removedTimestamp: removedVersion?.timestamp,
            restoredTimestamp: previousVersion.timestamp,
        });

        return this.currentHtml;
    }

    validateHtml(html: string): boolean {
        elizaLogger.log("Starting HTML validation");

        // Check for doctype and basic HTML structure
        const hasDoctype = html.toLowerCase().includes("<!doctype html>");
        const hasHtmlTags = this.validateTagPair(html, "html");
        const hasHeadTags = this.validateTagPair(html, "head");
        const hasBodyTags = this.validateTagPair(html, "body");

        // Check for essential meta tags
        const hasCharsetMeta =
            html.includes('charset="utf-8"') ||
            html.includes("charset='utf-8'");
        const hasViewportMeta = html.includes('name="viewport"');

        // Check for content structure
        const hasTitle = this.validateTagPair(html, "title");
        const hasMainContent =
            this.validateTagPair(html, "main") ||
            this.validateTagPair(html, "div");

        // Validate script tags
        const scriptTags = this.validateScriptTags(html);

        // Check for complete content
        const hasCompleteStructure =
            hasDoctype && hasHtmlTags && hasHeadTags && hasBodyTags;
        const hasEssentialMeta = hasCharsetMeta && hasViewportMeta;
        const hasContent = hasTitle && hasMainContent;

        // Check for unclosed tags
        const hasUnclosedTags = this.findUnclosedTags(html).length > 0;

        elizaLogger.log("Validation results", {
            hasDoctype,
            hasHtmlTags,
            hasHeadTags,
            hasBodyTags,
            hasCharsetMeta,
            hasViewportMeta,
            hasTitle,
            hasMainContent,
            scriptTags,
            hasUnclosedTags,
        });

        return (
            hasCompleteStructure &&
            hasEssentialMeta &&
            hasContent &&
            scriptTags.isValid &&
            !hasUnclosedTags
        );
    }

    private validateTagPair(html: string, tagName: string): boolean {
        const openTag = new RegExp(`<${tagName}[^>]*>`, "gi");
        const closeTag = new RegExp(`</${tagName}>`, "gi");
        const openCount = (html.match(openTag) || []).length;
        const closeCount = (html.match(closeTag) || []).length;
        return openCount > 0 && openCount === closeCount;
    }

    private validateScriptTags(html: string): {
        isValid: boolean;
        openCount: number;
        closeCount: number;
    } {
        const scriptOpenTags = (html.match(/<script[^>]*>/g) || []).length;
        const scriptCloseTags = (html.match(/<\/script>/g) || []).length;
        return {
            isValid: scriptOpenTags === scriptCloseTags && scriptOpenTags > 0,
            openCount: scriptOpenTags,
            closeCount: scriptCloseTags,
        };
    }

    private findUnclosedTags(html: string): string[] {
        const stack: string[] = [];
        const unclosedTags: string[] = [];
        const tagPattern = /<\/?([a-z0-9]+)[^>]*>/gi;
        let match;

        while ((match = tagPattern.exec(html)) !== null) {
            const fullTag = match[0];
            const tagName = match[1].toLowerCase();

            // Skip self-closing tags
            if (
                fullTag.endsWith("/>") ||
                ["meta", "link", "img", "br", "hr"].includes(tagName)
            ) {
                continue;
            }

            if (!fullTag.startsWith("</")) {
                stack.push(tagName);
            } else {
                if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
                    unclosedTags.push(tagName);
                } else {
                    stack.pop();
                }
            }
        }

        return [...stack, ...unclosedTags];
    }
}

const websiteMemory = new WebsiteMemoryManager();

export const generateHtmlContent = async (
    title: string,
    runtime: IAgentRuntime,
    state: State,
    websitePrompt?: string
): Promise<string> => {
    elizaLogger.log(`Starting HTML content generation for page: ${title}`, {
        hasWebsitePrompt: !!websitePrompt,
        isGame: title.toLowerCase().includes("game"),
    });

    // Generate a unique ID for this website
    const websiteId = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
    const htmlManager = new HtmlManager(websiteId);

    // Initialize website in memory
    websiteMemory.createWebsite(websiteId, title, websitePrompt);

    // Generate initial HTML content
    const initialContent = await generateHtml({
        runtime,
        context: composeContext({
            state,
            template: `Generate HTML content for ${title}.
            ${websitePrompt ? `Additional requirements: ${websitePrompt}` : ""}
            
            Requirements:
            1. Use semantic HTML5 elements
            2. Basic Tailwind CSS styling
            3. Include DOCTYPE and meta tags
            4. Mark as static page
            5. Keep structure minimal
            6. For games:
               - Include complete Phaser CDN script (v3.55.2+)
               - Add canvas element with id="game" and proper viewport settings
               - Add COMPLETE game initialization with proper config:
                 * Physics system setup (arcade physics)
                 * Scene management
                 * Input handling
                 * Asset loading
               - Implement core game loop with:
                 * preload(): Load all assets (sprites, audio, etc.)
                 * create(): Setup game objects, collisions, input
                 * update(): Handle game logic, collisions, scoring
               - Include ALL game mechanics:
                 * Player movement and controls
                 * Collision detection and response
                 * Score/lives tracking
                 * Win/lose conditions
                 * Power-ups and special abilities
               - Implement complete state management:
                 * Game state (menu, playing, paused, game over)
                 * Player state (position, velocity, health)
                 * Persistent data (high scores, settings)
               - Add proper error handling and debugging
               - Include performance optimizations
            7. For websites:
               - Focus on content presentation
               - Include responsive layout
               - Include COMPLETE implementation of all interactive features
               - Include ALL event handlers and DOM manipulations
               - Ensure ALL JavaScript functionality is fully implemented
            8. Use pixel-based graphics:
               - Create pixel art sprites and textures
               - Use pixel-perfect rendering
               - Maintain consistent pixel scale
               - Optimize pixel graphics for performance
               - Use sprite sheets for animations
               - Implement proper pixel scaling for different screen sizes
            
            ${
                title.toLowerCase().includes("game")
                    ? `Generate a complete Phaser game setup with canvas and FULL game implementation code. Here's an example of what I'm looking for:

                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Snake Game</title>
                                <script src="https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js"></script>
                                <style>
                                    body {
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        height: 100vh;
                                        margin: 0;
                                        background-color: #2c3e50;
                                    }
                                    #game-container {
                                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                                    }
                                </style>
                            </head>
                            <body>
                                <div id="game-container"></div>
                                <script>
                                    const config = {
                                        type: Phaser.AUTO,
                                        width: 400,
                                        height: 400,
                                        backgroundColor: '#34495e',
                                        parent: 'game-container',
                                        scene: {
                                            preload: preload,
                                            create: create,
                                            update: update
                                        }
                                    };

                                    const game = new Phaser.Game(config);

                                    let snake = [];
                                    let food;
                                    let cursors;
                                    let direction = 'right';
                                    let newDirection = 'right';
                                    let moving = false;
                                    let lastMoveTime = 0;
                                    const moveInterval = 150;
                                    const gridSize = 20;

                                    function preload() {
                                        // No assets to preload
                                    }

                                    function create() {
                                        // Create snake
                                        snake = [];
                                        const startX = 3;
                                        const startY = 10;
                                        
                                        for (let i = 0; i < 3; i++) {
                                            const segment = this.add.rectangle(
                                                (startX - i) * gridSize + gridSize/2,
                                                startY * gridSize + gridSize/2,
                                                gridSize - 2,
                                                gridSize - 2,
                                                0x00ff00
                                            );
                                            snake.push(segment);
                                        }

                                        // Create food
                                        food = this.add.rectangle(0, 0, gridSize - 2, gridSize - 2, 0xff0000);
                                        placeFood();

                                        // Setup keyboard controls
                                        cursors = this.input.keyboard.createCursorKeys();

                                        // Add score text
                                        this.score = 0;
                                        this.scoreText = this.add.text(16, 16, 'Score: 0', { 
                                            fontSize: '20px', 
                                            fill: '#fff' 
                                        });

                                        // Add game over text (hidden initially)
                                        this.gameOverText = this.add.text(200, 200, 'Game Over!\nPress SPACE to restart', {
                                            fontSize: '32px',
                                            fill: '#fff',
                                            align: 'center'
                                        });
                                        this.gameOverText.setOrigin(0.5);
                                        this.gameOverText.visible = false;

                                        // Add space key for restart
                                        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
                                    }

                                    function update(time) {
                                        if (this.gameOverText.visible) {
                                            if (this.spaceKey.isDown) {
                                                restartGame.call(this);
                                            }
                                            return;
                                        }

                                        // Handle input
                                        if (cursors.left.isDown && direction !== 'right') {
                                            newDirection = 'left';
                                        } else if (cursors.right.isDown && direction !== 'left') {
                                            newDirection = 'right';
                                        } else if (cursors.up.isDown && direction !== 'down') {
                                            newDirection = 'up';
                                        } else if (cursors.down.isDown && direction !== 'up') {
                                            newDirection = 'down';
                                        }

                                        // Move snake at fixed intervals
                                        if (time >= lastMoveTime + moveInterval) {
                                            moveSnake.call(this);
                                            lastMoveTime = time;
                                        }
                                    }

                                    function moveSnake() {
                                        direction = newDirection;
                                        
                                        // Calculate new head position
                                        const headX = snake[0].x;
                                        const headY = snake[0].y;
                                        let newX = headX;
                                        let newY = headY;

                                        switch (direction) {
                                            case 'left':
                                                newX -= gridSize;
                                                break;
                                            case 'right':
                                                newX += gridSize;
                                                break;
                                            case 'up':
                                                newY -= gridSize;
                                                break;
                                            case 'down':
                                                newY += gridSize;
                                                break;
                                        }

                                        // Check collision with walls
                                        if (newX < 0 || newX >= config.width || 
                                            newY < 0 || newY >= config.height) {
                                            gameOver.call(this);
                                            return;
                                        }

                                        // Check collision with self
                                        for (let segment of snake) {
                                            if (newX === segment.x && newY === segment.y) {
                                                gameOver.call(this);
                                                return;
                                            }
                                        }

                                        // Check if food is eaten
                                        if (newX === food.x && newY === food.y) {
                                            // Increase score
                                            this.score += 10;
                                            this.scoreText.setText('Score: ' + this.score);
                                            
                                            // Don't remove tail if food is eaten
                                            placeFood();
                                        } else {
                                            // Remove tail
                                            snake[snake.length - 1].destroy();
                                            snake.pop();
                                        }

                                        // Add new head
                                        const newHead = this.add.rectangle(
                                            newX,
                                            newY,
                                            gridSize - 2,
                                            gridSize - 2,
                                            0x00ff00
                                        );
                                        snake.unshift(newHead);
                                    }

                                    function placeFood() {
                                        const gridWidth = Math.floor(config.width / gridSize);
                                        const gridHeight = Math.floor(config.height / gridSize);
                                        
                                        let validPosition = false;
                                        let newX, newY;

                                        while (!validPosition) {
                                            newX = Math.floor(Math.random() * gridWidth) * gridSize + gridSize/2;
                                            newY = Math.floor(Math.random() * gridHeight) * gridSize + gridSize/2;
                                            
                                            validPosition = true;
                                            
                                            // Check if position overlaps with snake
                                            for (let segment of snake) {
                                                if (newX === segment.x && newY === segment.y) {
                                                    validPosition = false;
                                                    break;
                                                }
                                            }
                                        }

                                        food.setPosition(newX, newY);
                                    }

                                    function gameOver() {
                                        this.gameOverText.visible = true;
                                    }

                                    function restartGame() {
                                        // Reset game state
                                        this.score = 0;
                                        this.scoreText.setText('Score: 0');
                                        this.gameOverText.visible = false;
                                        direction = 'right';
                                        newDirection = 'right';
                                        
                                        // Destroy existing snake
                                        for (let segment of snake) {
                                            segment.destroy();
                                        }
                                        
                                        // Create new snake
                                        snake = [];
                                        const startX = 3;
                                        const startY = 10;
                                        
                                        for (let i = 0; i < 3; i++) {
                                            const segment = this.add.rectangle(
                                                (startX - i) * gridSize + gridSize/2,
                                                startY * gridSize + gridSize/2,
                                                gridSize - 2,
                                                gridSize - 2,
                                                0x00ff00
                                            );
                                            snake.push(segment);
                                        }
                                        
                                        // Place food in new position
                                        placeFood();
                                    }
                                </script>
                            </body>
                            </html>`
                    : "Generate a complete, interactive website layout with ALL functionality implemented."
            }
            
            Output ONLY valid HTML code with complete implementations.`,
        }),
        modelClass: ModelClass.MEDIUM,
    });

    let htmlContent = htmlManager.generateInitialHtml(initialContent);
    let continuationAttempts = 0;

    elizaLogger.log("Initial HTML content generated", htmlContent);

    // Check if content needs continuation with a maximum attempt limit
    while (
        !htmlManager.validateHtml(htmlContent) &&
        continuationAttempts < htmlManager.maxContinuationAttempts
    ) {
        elizaLogger.log("HTML content needs continuation, analyzing...", {
            attempt: continuationAttempts + 1,
            maxAttempts: htmlManager.maxContinuationAttempts,
        });
        continuationAttempts++;

        // Check if we have a complete HTML document structure
        const hasCompleteStructure = htmlContent.includes('<!DOCTYPE html>') &&
            htmlContent.includes('<html') &&
            htmlContent.includes('</html>') &&
            htmlContent.includes('<head>') && 
            htmlContent.includes('</head>') &&
            htmlContent.includes('<body>') &&
            htmlContent.includes('</body>');

        if (hasCompleteStructure) {
            elizaLogger.log("Complete HTML document structure detected, no continuation needed");
            break;
        }

        const lastCompleteElementMatch = htmlContent.match(
            /(?:(?:<[^>]+>[^<]*<\/[^>]+>)|(?:<script[^>]*>[\s\S]*?<\/script>))(?!.*(?:<\/[^>]+>|<\/script>))/
        );
        const lastCompleteElement = lastCompleteElementMatch
            ? lastCompleteElementMatch[0]
            : "";

        // Only proceed if we found a meaningful last complete element
        if (!lastCompleteElement) {
            elizaLogger.warn(
                "No meaningful last complete element found, stopping continuation"
            );
            break;
        }
        elizaLogger.log("Last complete element found:", {
            element: lastCompleteElement.substring(0, 100) + "...",
        });

        const incompleteScriptMatch = htmlContent.match(
            /<script[^>]*>(?:[^<]*(?:<(?!\/script>)[^<]*)*)?$/
        );
        const partialJsCode = incompleteScriptMatch
            ? incompleteScriptMatch[0].replace(/<script[^>]*>/, "").trim()
            : "";

        // Only log if there's actual incomplete script code
        if (partialJsCode) {
            elizaLogger.log("Incomplete script code found:", {
                code: partialJsCode.substring(0, 100) + "...",
            });
        }

        elizaLogger.log(
            `Requesting continuation (attempt ${continuationAttempts}/${htmlManager.maxContinuationAttempts})...`
        );
        const newContent = await htmlManager.applyContinuation(
            runtime,
            state,
            htmlContent,
            lastCompleteElement,
            partialJsCode
        );

        // Check if the content actually changed
        if (newContent === htmlContent) {
            elizaLogger.warn(
                "No changes in continuation, stopping to prevent infinite loop"
            );
            break;
        }

        htmlContent = newContent;
        elizaLogger.log("Continuation applied successfully", {
            newContentLength: newContent.length,
        });

        // After each successful HTML generation or continuation, add:
        // websiteMemory.addVersion(websiteId, htmlContent, {
        //     added: diffGenerated.filter((part) => part.added).length,
        //     removed: diffGenerated.filter((part) => part.removed).length,
        //     modified: diffGenerated.length,
        // });
    }

    if (continuationAttempts >= htmlManager.maxContinuationAttempts) {
        elizaLogger.warn(
            "Max continuation attempts reached, returning best effort result",
            {
                attempts: continuationAttempts,
                finalContentLength: htmlContent.length,
            }
        );
    }

    elizaLogger.log("HTML content generation completed", {
        title,
        finalLength: htmlContent.length,
        continuationAttempts,
        websiteStats: websiteMemory.getStats(websiteId),
    });

    return htmlContent;
};
