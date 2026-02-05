import { log } from './utils/log.mjs';
import { Plugins, Actions, eventEmitter } from './utils/plugin.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugin = new Plugins('synology');

class SynologyAPI {
  constructor() {
    this.sid = null;
    this.hostUrl = '';
    this.settings = {};
  }

  updateSettings(settings) {
    this.settings = settings;
    const protocol = settings.protocol || 'http';
    const host = settings.host || 'localhost';
    const port = settings.port || (protocol === 'https' ? 5001 : 5000);
    this.hostUrl = `${protocol}://${host}:${port}`;
    this.sid = null; // Reset SID on settings change
  }

  async request(api, method, version, params = {}, useSid = true) {
    if (!this.hostUrl) return null;

    let urlPath = '/webapi/entry.cgi';
    if (api === 'SYNO.API.Auth') {
        urlPath = '/webapi/auth.cgi';
    } else if (api === 'SYNO.API.Info') {
        urlPath = '/webapi/query.cgi';
    }

    const searchParams = new URLSearchParams({
      api,
      method,
      version: version.toString(),
      ...params,
    });

    if (useSid && this.sid) {
      searchParams.append('_sid', this.sid);
    }

    try {
      const fullUrl = `${this.hostUrl}${urlPath}?${searchParams.toString()}`;
      // log.info(`Requesting: ${fullUrl.replace(/passwd=[^&]*/, 'passwd=****')}`);
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data.success) {
        log.error(`API Error: ${JSON.stringify(data.error)}`);
        if (data.error && (data.error.code === 105 || data.error.code === 106)) {
            this.sid = null;
        }
        return null;
      }
      return data.data;
    } catch (error) {
      log.error(`Fetch error: ${error.message}`);
      return null;
    }
  }

  async login() {
    if (!this.settings.username || !this.settings.password) {
        return false;
    }
    const data = await this.request('SYNO.API.Auth', 'login', 3, {
      account: this.settings.username,
      passwd: this.settings.password,
      session: 'StreamDock',
      format: 'sid'
    }, false);

    if (data && data.sid) {
      this.sid = data.sid;
      log.info('Logged in successfully');
      return true;
    }
    return false;
  }

  async getStorageInfo() {
    if (!this.sid && !(await this.login())) return null;
    return await this.request('SYNO.Storage.Storage.Volume', 'list', 1);
  }

  async getUtilization() {
    if (!this.sid && !(await this.login())) return null;
    return await this.request('SYNO.Core.System.Utilization', 'get', 1);
  }
}

const syno = new SynologyAPI();
let updateTimer = null;
let currentInterval = 60;

const refreshData = async () => {
  if (!syno.hostUrl) return;
  log.info('Refreshing Synology data...');
  const storage = await syno.getStorageInfo();
  const utilization = await syno.getUtilization();

  eventEmitter.emit('dataUpdated', { storage, utilization });
};

const startPolling = (intervalS) => {
    const newInterval = parseInt(intervalS) || 60;
    if (updateTimer && currentInterval === newInterval) return;

    if (updateTimer) clearInterval(updateTimer);
    currentInterval = newInterval;
    const ms = currentInterval * 1000;
    updateTimer = setInterval(refreshData, ms);
    refreshData();
};

// Storage Action
plugin.storage = class extends Actions {
  async _willAppear({ context, payload }) {
    this.settings = payload.settings;
    if (this.settings.host) {
        syno.updateSettings(this.settings);
        startPolling(this.settings.interval);
    }
    this.unsubscribe = eventEmitter.subscribe('dataUpdated', (data) => {
      if (data.storage && data.storage.volumes) {
        const vol = data.storage.volumes[0];
        if (vol) {
            const usedPercent = Math.round((parseInt(vol.size.used) / parseInt(vol.size.total)) * 100);
            const freeGB = Math.round(parseInt(vol.size.free) / (1024 * 1024 * 1024));
            plugin.setTitle(context, `Storage\n${usedPercent}%\nFree: ${freeGB}GB`);
        }
      } else {
          plugin.setTitle(context, 'NAS Offline');
      }
    });
  }
  _didReceiveSettings({ payload }) {
    this.settings = payload.settings;
    syno.updateSettings(this.settings);
    startPolling(this.settings.interval);
  }
  _willDisappear() {
    if (this.unsubscribe) this.unsubscribe();
  }
};

// Utilization Action
plugin.utilization = class extends Actions {
  async _willAppear({ context, payload }) {
    this.settings = payload.settings;
    if (this.settings.host) {
        syno.updateSettings(this.settings);
        startPolling(this.settings.interval);
    }
    this.unsubscribe = eventEmitter.subscribe('dataUpdated', (data) => {
      if (data.utilization) {
        const cpu = data.utilization.cpu.user_load + data.utilization.cpu.system_load;
        const ram = data.utilization.memory.real_usage;
        plugin.setTitle(context, `CPU: ${cpu}%\nRAM: ${ram}%`);
      } else {
          plugin.setTitle(context, 'NAS Offline');
      }
    });
  }
  _didReceiveSettings({ payload }) {
      this.settings = payload.settings;
      syno.updateSettings(this.settings);
      startPolling(this.settings.interval);
  }
  _willDisappear() {
    if (this.unsubscribe) this.unsubscribe();
  }
};

// Status Action
plugin.status = class extends Actions {
  async _willAppear({ context, payload }) {
    this.settings = payload.settings;
    if (this.settings.host) {
        syno.updateSettings(this.settings);
        startPolling(this.settings.interval);
    }
    this.unsubscribe = eventEmitter.subscribe('dataUpdated', (data) => {
      if (data.storage || data.utilization) {
        plugin.setTitle(context, 'NAS Online\nHealthy');
        plugin.setState(context, 0);
      } else {
        plugin.setTitle(context, 'NAS Offline');
        plugin.setState(context, 1);
      }
    });
  }
  _didReceiveSettings({ payload }) {
      this.settings = payload.settings;
      syno.updateSettings(this.settings);
      startPolling(this.settings.interval);
  }
  _willDisappear() {
    if (this.unsubscribe) this.unsubscribe();
  }
};
