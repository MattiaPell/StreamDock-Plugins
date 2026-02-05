const $local = false, $back = false, $dom = {
    main: $('.sdpi-wrapper'),
    hostname: $('#hostname'),
    port: $('#port'),
    username: $('#username'),
    interval: $('#interval'),
    save: $('#save')
};

const saveClick = () => {
    if (!$settings) {
        console.error('Settings not initialized yet');
        return;
    }
    $settings.hostname = $dom.hostname.value;
    $settings.port = parseInt($dom.port.value) || 25565;
    $settings.username = $dom.username.value;
    $settings.interval = parseInt($dom.interval.value) || 60;
    console.log('Settings saved:', $settings);
};

$dom.save.addEventListener('click', saveClick);

const $propEvent = {
    didReceiveSettings(data) {
        console.log('Received settings:', $settings);
        $dom.hostname.value = $settings.hostname || '';
        $dom.port.value = $settings.port || 25565;
        $dom.username.value = $settings.username || '';
        $dom.interval.value = $settings.interval || 60;
    }
};
