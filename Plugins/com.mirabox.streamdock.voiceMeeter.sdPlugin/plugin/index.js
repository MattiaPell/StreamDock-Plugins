const { Plugins, Actions, log, EventEmitter } = require('./utils/plugin');
const { execSync } = require('child_process');
import { Voicemeeter, StripProperties } from "voicemeeter-connector";
const hotkeyManager = require('./utils/hotkey_manager');
const { addListener, removeListener, notifyListeners } = require("./utils/listener_controller");
const MidiSender = require('./utils/midiSender.js'); // 导入 MidiSender 类

// 实例化 MidiSender
const sender = new MidiSender();
const plugin = new Plugins('voice_meeter');
let vmInstance = null;
setInterval(async () => {
    if (vmInstance === null) {
        vmInstance = await initializeVoicemeeter()
    }
}, 1000)

async function initializeVoicemeeter() {
    try {
        const vm = await Voicemeeter.init();
        const result = vm.connect();
        // if(result.success && result.code !== 0) {
        //     vm.disconnect();
        //     throw new Error('voiceMeeter 未启动')
        // }
        log.info(result.message);
        // 全局监听变化
        vm.attachChangeEvent(() => notifyListeners(vm));
        return vm; // 返回连接实例以便后续使用
    } catch (error) {
        // log.error("Failed to initialize Voicemeeter:", error);
        // throw error; // 重新抛出错误以便外部处理
        return null;
    }
}
let hotkeyInitFlag = false;
plugin.didReceiveGlobalSettings = ({ payload: { settings } }) => {
    // log.info('didReceiveGlobalSettings', settings);
    try {
        // log.info(Object.values(settings.hotkeys))
        if (!hotkeyInitFlag) {
            let filterHotkeys = [];
            if(settings.hotkeys !== undefined) {
                Object.keys(settings.hotkeys).forEach(context => {
                    log.info(context)
                    if(settings.hotkeys[context] !== undefined && Object.keys(Actions.actions).includes(context.split('_')[0])) {
                        filterHotkeys.push(settings.hotkeys[context])
                    }
                })
            }
            // log.info(filterHotkeys)
            // --- 3. 启动快捷键管理器，并传入初始配置 ---
            const initialHotkeys = [
                // {
                //     id: "open_calc",
                //     context: "xx",
                //     fn_name: "",
                //     name: "打开计算器",
                //     shortcut: "CTRL+ALT+C",
                //     action: "my_custom_open_calc"
                // }
            ];
            hotkeyManager.start(filterHotkeys.length > 0 ? filterHotkeys : initialHotkeys);
            log.info('--- 应用程序启动 ---');
            log.info('全局键盘监听已启动。请尝试您的快捷键。');
            log.info('当前注册的快捷键:');
            hotkeyManager.listHotkeys().forEach(hk => {
                log.info(`- ${hk.name} (${hk.shortcut}) -> 动作: ${hk.action}`);
            });
            hotkeyInitFlag = true;
            settings.hotkeys = filterHotkeys.reduce((acc, i) => {
                acc[i.id] = i;
                return acc;
            }, {});
            plugin.setGlobalSettings(settings);
        }
    } catch (error) {
        hotkeyManager.start()
    }

};

const createSvg = (text) => `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">
    <text x="72" y="120" font-family="Arial" font-weight="bold" font-size="36" fill="white" text-anchor="middle"
        stroke="black" stroke-width="2" paint-order="stroke">
        ${text}
    </text>
</svg>`;

const timers = {};

// 创建一个虚拟代理
const vmProxy = new Proxy({}, {
    get(target, prop) {
        if (!vmInstance) {
            throw new Error("vmInstance 未初始化!");
        }
        return vmInstance[prop];
    }
});

const actionModules = [
    'modify_setting',
    'mute_unmute',
    'advanced_press_long_press',
    'advanced_toggle',
    'advanced_ptt',
    'macrobuttom_toggle',
    'gain_adjust',
    'setting_adjust'
];

const initParams = [plugin, vmProxy, addListener, log, timers, hotkeyManager, sender];

const initializeActions = async () => {
    // 使用 Promise.allSettled 并行加载所有模块
    const results = await Promise.allSettled(
        actionModules.map(moduleName => import(`./actions/${moduleName}.js`))
    );

    // 遍历所有模块的加载结果
    results.forEach((result, index) => {
        const moduleName = actionModules[index];

        // 检查加载状态
        if (result.status === 'fulfilled') {
            // 如果成功，则进行初始化
            plugin[moduleName] = new Actions(result.value.default(...initParams));
        } else {
            // 如果失败，打印错误信息，但不会中断程序
            console.error(`模块加载失败: ${moduleName}`, result.reason);
        }
    });
    
    console.log('模块初始化完成，部分模块可能失败。');
};

initializeActions();