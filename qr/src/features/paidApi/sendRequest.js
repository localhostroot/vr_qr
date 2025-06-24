const api = import.meta.env.VITE_REACT_APP_BACKEND;

const sendRequest = (clientId, location, type, videoId) => {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${api}`);

        ws.onopen = () => {
            const message = JSON.stringify({
                type: type,
                clientId: clientId,
                location: location,
                videoId: videoId || null
            });
            ws.send(message);
        };

        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            if (response.type === 'requestResponse') {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.message || 'Неизвестная ошибка'));
                }
            }
        };

        ws.onerror = (error) => {
            reject(error);
        };

        ws.onclose = () => {
            reject(new Error('Соединение закрыто без ответа'));
        };
    });
};

export default sendRequest;