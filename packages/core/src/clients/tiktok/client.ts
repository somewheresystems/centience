import axios from 'axios';
import FormData from 'form-data';

export class TikTokClient {
    private accessToken: string;
    private openId: string;
    private baseUrl = 'https://open.tiktokapis.com/v2';

    constructor({ accessToken, openId }: { accessToken: string; openId: string }) {
        this.accessToken = accessToken;
        this.openId = openId;
    }

    async initializeUpload(params: {
        post_info: {
            title: string;
            privacy_level: 'PUBLIC' | 'PRIVATE';
        };
    }) {
        const response = await axios.post(
            `${this.baseUrl}/video/upload/`,
            params,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    }

    async uploadVideo(uploadUrl: string, videoBuffer: Buffer) {
        const form = new FormData();
        form.append('video', videoBuffer, {
            filename: 'video.mp4',
            contentType: 'video/mp4'
        });

        await axios.post(uploadUrl, form, {
            headers: {
                ...form.getHeaders()
            }
        });
    }

    async publishVideo(params: {
        upload_id: string;
        title: string;
    }) {
        const response = await axios.post(
            `${this.baseUrl}/video/publish/`,
            params,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    }
} 