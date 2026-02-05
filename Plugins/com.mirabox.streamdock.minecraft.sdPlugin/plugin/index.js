const { Plugins, Actions, log } = require('./utils/plugin');
const https = require('https');

const plugin = new Plugins();

// Helper to fetch JSON from URL
function getJSON(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
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
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });
    });
}

// Helper to fetch image and return base64 data URI
function getImageBase64(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
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
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Image Timeout'));
        });
    });
}

const createServerSvg = (onlinePlayers, serverIconBase64, statusText = '') => {
    const players = String(onlinePlayers).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        ${serverIconBase64 ? `<image xlink:href="${serverIconBase64}" x="0" y="0" width="144" height="144" />` : `<rect width="144" height="144" fill="#333" />`}
        <rect x="0" y="44" width="144" height="56" fill="black" fill-opacity="0.6" />
        <text x="72" y="88" font-family="Arial" font-weight="bold" font-size="42" fill="#ffff00" text-anchor="middle" stroke="black" stroke-width="1" paint-order="stroke">
            ${players}
        </text>
        ${statusText ? `<text x="72" y="130" font-family="Arial" font-size="18" fill="white" text-anchor="middle" stroke="black" stroke-width="1">${statusText}</text>` : ''}
    </svg>`;
};

const createPlayerSvg = (online, playerHeadBase64, username = '') => {
    const opacity = online ? 1.0 : 0.4;
    return `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <g opacity="${opacity}">
            ${playerHeadBase64 ? `<image xlink:href="${playerHeadBase64}" x="0" y="0" width="144" height="144" />` : `<rect width="144" height="144" fill="#555" />`}
        </g>
        <rect x="0" y="110" width="144" height="34" fill="black" fill-opacity="0.5" />
        <text x="72" y="132" font-family="Arial" font-weight="bold" font-size="16" fill="white" text-anchor="middle" stroke="black" stroke-width="1">
            ${username.substring(0, 12)}
        </text>
        ${!online ? `<line x1="0" y1="0" x2="144" y2="144" stroke="red" stroke-width="8" opacity="0.6" />
                     <line x1="144" y1="0" x2="0" y2="144" stroke="red" stroke-width="8" opacity="0.6" />` : ''}
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
        if (!hostname) {
            const svg = createServerSvg('?', null, 'Set Host');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            return;
        }

        try {
            const data = await getJSON(`https://api.mcstatus.io/v2/status/java/${hostname}${port !== 25565 ? ':' + port : ''}`);
            const onlinePlayers = data.online ? data.players.online : 'OFF';
            const icon = data.icon;

            const svg = createServerSvg(onlinePlayers, icon);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        } catch (error) {
            log.error('Server Update Error:', error);
            const svg = createServerSvg('ERR', null, 'API Error');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
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
        if (!hostname || !username) {
            const svg = createPlayerSvg(false, null, username || 'No Name');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            return;
        }

        try {
            const data = await getJSON(`https://api.mcstatus.io/v2/status/java/${hostname}${port !== 25565 ? ':' + port : ''}`);
            let online = false;
            if (data.online && data.players.list) {
                online = data.players.list.some(p => p.name.toLowerCase() === username.toLowerCase());
            }

            let headBase64 = null;
            try {
                headBase64 = await getImageBase64(`https://mc-heads.net/avatar/${username}/144`);
            } catch (e) {
                log.error('Player Head Fetch Error:', e);
            }

            const svg = createPlayerSvg(online, headBase64, username);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        } catch (error) {
            log.error('Player Update Error:', error);
            const svg = createPlayerSvg(false, null, 'API Error');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
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
