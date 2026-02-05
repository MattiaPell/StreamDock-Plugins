const { Plugins, Actions, log } = require('./utils/plugin');
const https = require('https');

const plugin = new Plugins();

// Helper to fetch JSON from URL
function getJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status Code: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Helper to fetch image and return base64 data URI
function getImageBase64(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status Code: ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const type = res.headers['content-type'];
                resolve(`data:${type};base64,${buffer.toString('base64')}`);
            });
        }).on('error', reject);
    });
}

const createServerSvg = (onlinePlayers, serverIconBase64) => {
    // Escape characters for SVG
    const players = String(onlinePlayers).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">
        ${serverIconBase64 ? `<image href="${serverIconBase64}" x="0" y="0" width="144" height="144" />` : `<rect width="144" height="144" fill="#333" />`}
        <rect x="0" y="44" width="144" height="56" fill="black" fill-opacity="0.6" />
        <text x="72" y="82" font-family="Arial" font-weight="bold" font-size="40" fill="white" text-anchor="middle" stroke="black" stroke-width="1" paint-order="stroke">
            ${players}
        </text>
    </svg>`;
};

const createPlayerSvg = (online, playerHeadBase64) => {
    const opacity = online ? 1.0 : 0.5;
    return `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">
        <g opacity="${opacity}">
            ${playerHeadBase64 ? `<image href="${playerHeadBase64}" x="0" y="0" width="144" height="144" />` : `<rect width="144" height="144" fill="#555" />`}
        </g>
        ${!online ? `<line x1="0" y1="0" x2="144" y2="144" stroke="red" stroke-width="5" opacity="0.8" />
                     <line x1="144" y1="0" x2="0" y2="144" stroke="red" stroke-width="5" opacity="0.8" />` : ''}
    </svg>`;
};

const timers = {};

// Server Status Action
plugin.server = new Actions({
    async _willAppear({ context, payload }) {
        this.update(context, payload.settings);
        this.startTimer(context);
    },
    _willDisappear({ context }) {
        this.stopTimer(context);
    },
    _didReceiveSettings({ context, payload }) {
        this.update(context, payload.settings);
        this.startTimer(context);
    },
    async update(context, settings) {
        const { hostname, port = 25565 } = settings;
        if (!hostname) return;

        try {
            const data = await getJSON(`https://api.mcstatus.io/v2/status/java/${hostname}${port !== 25565 ? ':' + port : ''}`);
            const onlinePlayers = data.online ? data.players.online : 'OFF';
            const icon = data.icon; // Already base64 data URI or null

            const svg = createServerSvg(onlinePlayers, icon);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        } catch (error) {
            log.error('Server Update Error:', error);
            // Set error image or keep old one
        }
    },
    startTimer(context) {
        this.stopTimer(context);
        const interval = (this.data[context].interval || 60) * 1000;
        timers[context] = setInterval(() => this.update(context, this.data[context]), interval);
    },
    stopTimer(context) {
        if (timers[context]) {
            clearInterval(timers[context]);
            delete timers[context];
        }
    }
});

// Player Status Action
plugin.player = new Actions({
    async _willAppear({ context, payload }) {
        this.update(context, payload.settings);
        this.startTimer(context);
    },
    _willDisappear({ context }) {
        this.stopTimer(context);
    },
    _didReceiveSettings({ context, payload }) {
        this.update(context, payload.settings);
        this.startTimer(context);
    },
    async update(context, settings) {
        const { hostname, port = 25565, username } = settings;
        if (!hostname || !username) return;

        try {
            // Check if player is online
            const data = await getJSON(`https://api.mcstatus.io/v2/status/java/${hostname}${port !== 25565 ? ':' + port : ''}`);
            let online = false;
            if (data.online && data.players.list) {
                online = data.players.list.some(p => p.name.toLowerCase() === username.toLowerCase());
            }

            // Fetch player head
            let headBase64 = null;
            try {
                headBase64 = await getImageBase64(`https://mc-heads.net/avatar/${username}/144`);
            } catch (e) {
                log.error('Player Head Fetch Error:', e);
            }

            const svg = createPlayerSvg(online, headBase64);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        } catch (error) {
            log.error('Player Update Error:', error);
        }
    },
    startTimer(context) {
        this.stopTimer(context);
        const interval = (this.data[context].interval || 60) * 1000;
        timers[context] = setInterval(() => this.update(context, this.data[context]), interval);
    },
    stopTimer(context) {
        if (timers[context]) {
            clearInterval(timers[context]);
            delete timers[context];
        }
    }
});
