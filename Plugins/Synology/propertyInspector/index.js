let $dom = {
    host: $('#host'),
    port: $('#port'),
    protocol: $('#protocol'),
    username: $('#username'),
    password: $('#password'),
    interval: $('#interval'),
    save: $('#save')
};

$propEvent.didReceiveSettings = (payload) => {
    const settings = payload.settings;
    if (settings.host) $dom.host.value = settings.host;
    if (settings.port) $dom.port.value = settings.port;
    if (settings.protocol) $dom.protocol.value = settings.protocol;
    if (settings.username) $dom.username.value = settings.username;
    if (settings.password) $dom.password.value = settings.password;
    if (settings.interval) $dom.interval.value = settings.interval;
};

$dom.save.on('click', () => {
    const payload = {
        host: $dom.host.value,
        port: $dom.port.value,
        protocol: $dom.protocol.value,
        username: $dom.username.value,
        password: $dom.password.value,
        interval: $dom.interval.value
    };
    $websocket.saveData(payload);
});
