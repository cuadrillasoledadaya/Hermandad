export interface NotificationPayload {
    title: string;
    content: string;
    platforms: string[];
}

export async function sendToSocialMedia(payload: NotificationPayload) {
    const webhookUrl = process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('MAKE_WEBHOOK_URL is not defined in .env');
        return { success: false, error: 'Webhook URL missing' };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...payload,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Error triggering webhook: ${response.statusText}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Failed to send notification via Make.com:', error);
        return { success: false, error: error.message };
    }
}
