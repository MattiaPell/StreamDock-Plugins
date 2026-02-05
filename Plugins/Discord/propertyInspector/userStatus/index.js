/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

const $local = true,
  $back = false,
  $dom = {
    main: $('.sdpi-wrapper'),
    logout: $('#logout'),
    logoutdiv: $('#logoutdiv'),
    user: $('#user'),
    userBox: $('#userBox'),
  };

const $propEvent = {
  didReceiveSettings(data) {
    $websocket.getGlobalSettings();
    console.log(data);
    if ('voice_states' in data.settings) {
      $dom.user.innerHTML = '';
      data.settings.voice_states.forEach((item) => {
        $dom.user.innerHTML += `<option value="${item.user.id}">${item.user.global_name ? item.user.global_name : item.user.username}</option>`;
      });
      $dom.user.value = data.settings.user;
      $dom.userBox.style.display = 'flex';
    } else {
      $dom.userBox.style.display = 'none';
    }
  },

  didReceiveGlobalSettings({ settings }) {
    console.log('Global setting');
    if (!settings.clientSecret) {
      openAuthorization();
    } else {
      $dom.logoutdiv.style.display = 'flex';
    }
  },
};

$dom.user.on('change', (e) => {
  $settings.user = $dom.user.value;
});

$dom.logout.on('click', () => {
  $websocket.setGlobalSettings({ clientId: '', clientSecret: '', accessToken: '' });
});
