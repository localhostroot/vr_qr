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
            console.log('Полученный ответ:', response);
            if (response.type === 'requestResponse') {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.message || 'Неизвестная ошибка'));
                }
            } else {
                console.log('Получено сообщение другого типа:', response);
            }
        };

        ws.onerror = (error) => {
            console.error('Ошибка вебсокета:', error);
            reject(error);
        };

        ws.onclose = () => {
            console.log('Подключение закрыто');
            reject(new Error('Соединение закрыто без ответа'));
        };
    });
};

export default sendRequest;