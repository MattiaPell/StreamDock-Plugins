// 配置日志文件
const now = new Date();
const log = require('log4js').configure({
    appenders: {
        file: { type: 'file', filename: `./log/${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}.log` }
    },
    categories: {
        default: { appenders: ['file'], level: 'info' }
    }
}).getLogger();
// log.info(process.argv);
// 主线程错误处理
process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason) => {
    log.error('Unhandled Rejection:', reason);
});

// 插件类
const ws = require('ws');
class Plugins {
    static language = (() => {
        try {
            const arg = process.argv[9];
            if (!arg) return 'en'; // 默认值
            let config = arg;
            
            if(typeof arg == 'string') {
                const fixedJSON = arg
                .replace(/^"(.*)"$/, '$1')  // 移除外层双引号
                .replace(/'/g, '"');       // 单引号转双引号

                config = JSON.parse(fixedJSON)
            }
            log.info(config?.application?.language);
            return config?.application?.language || 'en'; // 可选链 + 默认值
        } catch (err) {
            log.error('Failed to parse language config:', err);
            return 'en'; // 默认值
        }
    })();
    constructor() {
        if (Plugins.instance) {
            return Plugins.instance;
        }
        this.ws = new ws("ws://127.0.0.1:" + process.argv[3]);
        this.ws.on('open', () => this.ws.send(JSON.stringify({ uuid: process.argv[5], event: process.argv[7] })));
        this.ws.on('close', process.exit);
        this.ws.on('message', e => {
            const data = JSON.parse(e.toString());
            const action = data.action?.split('.').pop();
            this[action]?.[data.event]?.(data);
            this[data.event]?.(data);
        });
        Plugins.instance = this;
    }
    // 设置标题
    setTitle(context, str, row = 0, num = 6) {
        let newStr = '';
        if (row) {
            let nowRow = 1, strArr = str.split('');
            strArr.forEach((item, index) => {
                if (nowRow < row && index >= nowRow * num) { nowRow++; newStr += '\n'; }
                if (nowRow <= row && index < nowRow * num) { newStr += item; }
            });
            if (strArr.length > row * num) { newStr = newStr.substring(0, newStr.length - 1); newStr += '..'; }
        }
        this.ws.send(JSON.stringify({
            event: "setTitle",
            context, payload: {
                target: 0,
                title: newStr || str
            }
        }));
    }
    // 设置背景
    setImage(context, url) {
        this.ws.send(JSON.stringify({
            event: "setImage",
            context, payload: {
                target: 0,
                image: url
            }
        }));
        // const image = new Image();
        // image.src = url; image.onload = () => {
        //     const canvas = document.createElement("canvas");
        //     canvas.width = image.naturalWidth;
        //     canvas.height = image.naturalHeight;
        //     const ctx = canvas.getContext("2d");
        //     ctx.drawImage(image, 0, 0);
        //     this.ws.send(JSON.stringify({
        //         event: "setImage",
        //         context, payload: {
        //             target: 0,
        //             image: canvas.toDataURL("image/png")
        //         }
        //     }));
        // };
    }
    // 设置状态 设置过setImage后无法在使用
    setState(context, state) {
        log.info(context, state);
        this.ws.send(JSON.stringify({
            event: "setState",
            context, payload: { state }
        }));
    }
    // 保存持久化数据
    setSettings(context, payload) {
        this.ws.send(JSON.stringify({
            event: "setSettings",
            context, payload
        }));
    }
    // 发送给属性检测器
    sendToPropertyInspector(payload) {
        this.ws.send(JSON.stringify({
            action: Actions.currentAction,
            context: Actions.currentContext,
            payload, event: "sendToPropertyInspector"
        }));
    }
    // 用默认浏览器打开网页
    openUrl(url) {
        this.ws.send(JSON.stringify({
            event: "openUrl",
            payload: { url }
        }));
    }
};

// 操作类
class Actions {
    constructor(data) {
        this.data = {};
        this.default = {};
        Object.assign(this, data);
    }
    // 属性检查器显示时
    static currentAction = null;
    static currentContext = null;
    propertyInspectorDidAppear(data) {
        Actions.currentAction = data.action;
        Actions.currentContext = data.context;
        this._propertyInspectorDidAppear?.(data);
    }
    // 初始化数据
    willAppear(data) {
        const { context, payload: { settings } } = data;
        this.data[context] = Object.assign({ ...this.default }, settings);
        this._willAppear?.(data);
    }
    // 行动销毁
    willDisappear(data) {
        this._willDisappear?.(data);
        delete this.data[data.context];
    }
}

module.exports = {
    log,
    Plugins,
    Actions,
};