export async function fetchWsClients() {
    const response = await fetch('/api/ws/clients');
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return data.clients || [];
}

export async function sendWsPayload(payload: any) {
    const response = await fetch('/api/ws/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '发送失败');
    }

    return response.json();
}
