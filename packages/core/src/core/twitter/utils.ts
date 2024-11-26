export function splitTextIntoTweets(text: string, maxLength: number = 280): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const tweets: string[] = [];
    let currentTweet = '';

    for (const sentence of sentences) {
        if ((currentTweet + sentence).length <= maxLength) {
            currentTweet += (currentTweet ? ' ' : '') + sentence;
        } else {
            if (currentTweet) tweets.push(currentTweet);
            currentTweet = sentence;
        }
    }
    
    if (currentTweet) tweets.push(currentTweet);
    return tweets;
} 