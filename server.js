const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function (...args) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Throttled broadcast function
const throttledBroadcast = throttle((user, final_data, isBinary, socket) => {
    const my_room = rooms.get(user);
    const jsonData = JSON.parse(final_data);
    jsonData.clientCount = my_room.size;
    const last_data = JSON.stringify(jsonData);

    rooms.get(user).forEach((client) => {
        if (client.readyState === WebSocket.OPEN && socket !== client) {
            client.send(last_data, { binary: isBinary });
        }
    });
}, 1000);

wss.on('connection', (socket) => {
    socket.on('error', (err) => console.log(err));

    socket.on('message', (data, isBinary) => {
        const final_data = data.toString();
        const { user, session } = JSON.parse(final_data);

        console.log("Received message:", final_data);

        if (!rooms.has(user)) {
            rooms.set(user, new Set());
        }

        rooms.get(user).add(socket);
        throttledBroadcast(user, final_data, isBinary, socket);
    });

    socket.on('close', () => {
        console.log("Session is closed");
        for (const [user, clients] of rooms.entries()) {
            if (clients.has(socket)) {
                clients.delete(socket);
                if (clients.size === 0) {
                    rooms.delete(user);
                }
                break;
            }
        }
    });

    console.log("Hello from server!");
});

console.log(`WebSocket server is running on port ${PORT}`);
