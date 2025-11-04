// script.js - Updated to handle combined sensors, MQ135 and RFID

// --- MQTT config (keep in sync with ESP32) ---
const MQTT_BROKER_URL = "afc8a0ac2ccf462c8f92b932403518df.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USER = "hivemq.webclient.1761751067946";
const MQTT_PASS = "wy.b7f8cB*0GTUW&4Ha:";

const client = new Paho.MQTT.Client(MQTT_BROKER_URL, MQTT_PORT, "web-client-" + parseInt(Math.random() * 100));
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

let statusText = document.getElementById('status');
let statusDot = document.getElementById('status-dot');

let fanControl = document.getElementById("fan-control");
let lightControl = document.getElementById("light-control");
let fanStatus = document.getElementById("fan-status");
let lightStatus = document.getElementById("light-status");
let modeToggle = document.getElementById("mode-toggle");

// environment
let envTemp = document.getElementById('envTemp');
let envHum = document.getElementById('envHum');
let envPress = document.getElementById('envPress');
let dhtTemp = document.getElementById('dhtTemp');
let bmpTemp = document.getElementById('bmpTemp');

// mq135
let mqStatus = document.getElementById('mqStatus');
let mqRawEl = document.getElementById('mqRaw');
let mqIssue = document.getElementById('mqIssue');

// rfid
let rfidUid = document.getElementById('rfidUid');
let rfidAccess = document.getElementById('rfidAccess');

// Surveillance
let liveFeed = document.getElementById('liveFeed');

// connect
function connectMqtt() {
    statusText.textContent = "Connecting...";
    statusDot.style.background = "#f59e0b"; // yellow
    client.connect({
        userName: MQTT_USER,
        password: MQTT_PASS,
        useSSL: true,
        onSuccess: onConnect,
        onFailure: (err) => {
            statusText.textContent = "Disconnected";
            statusDot.style.background = "#ef4444";
            console.error("MQTT conn failed", err);
            setTimeout(connectMqtt, 3000);
        }
    });
}

function onConnect() {
    console.log("Connected to MQTT");
    statusText.textContent = "Connected";
    statusDot.style.background = "#10b981";
    client.subscribe("project/sensors");
    client.subscribe("project/status");
}

function onConnectionLost(responseObject) {
    console.log("MQTT connection lost", responseObject);
    statusText.textContent = "Disconnected";
    statusDot.style.background = "#ef4444";
    setTimeout(connectMqtt, 3000);
}

function onMessageArrived(message) {
    try {
        const topic = message.destinationName;
        const payload = JSON.parse(message.payloadString);
        if (topic === "project/sensors") {
            updateSensorReadings(payload);
        } else if (topic === "project/status") {
            updateControls(payload);
        }
    } catch (e) {
        console.error("Invalid JSON:", e);
    }
}

function updateSensorReadings(data) {
    // Temperatures
    if (data.avg_temp !== undefined && data.avg_temp !== null) envTemp.textContent = data.avg_temp.toFixed(1);
    else envTemp.textContent = "--";

    if (data.dht_humidity !== undefined && data.dht_humidity !== null) envHum.textContent = data.dht_humidity.toFixed(1);
    else envHum.textContent = "--";

    if (data.pressure_hpa !== undefined && data.pressure_hpa !== null) envPress.textContent = data.pressure_hpa.toFixed(0);
    else envPress.textContent = "--";

    if (data.dht_temp !== undefined && data.dht_temp !== null) dhtTemp.textContent = data.dht_temp.toFixed(1);
    else dhtTemp.textContent = "--";

    if (data.bmp_temp !== undefined && data.bmp_temp !== null) bmpTemp.textContent = data.bmp_temp.toFixed(1);
    else bmpTemp.textContent = "--";

    // MQ135
    if (data.mq135_status !== undefined) {
        mqStatus.textContent = data.mq135_status;
    } else mqStatus.textContent = "--";

    if (data.mq135_raw !== undefined) mqRawEl.textContent = data.mq135_raw;
    else mqRawEl.textContent = "--";

    // If MQ135 status indicates issue, show issue message
    let issue = "None";
    if (data.mq135_status === "Moderate") issue = "Slightly elevated pollutants — ventilation recommended.";
    if (data.mq135_status === "Poor") issue = "Poor air quality — possible smoke / gas. Check ventilation & sources.";
    if (data.mq135_status === "Dangerous") issue = "Dangerous air quality — possible leak or heavy smoke. Evacuate & check immediately.";
    mqIssue.textContent = issue;
}

function updateControls(data) {
    if (data.fan !== undefined) {
        if (data.fan) {
            fanControl.classList.add('active');
            fanStatus.textContent = "ON";
        } else {
            fanControl.classList.remove('active');
            fanStatus.textContent = "OFF";
        }
    }
    if (data.light !== undefined) {
        if (data.light) {
            lightControl.classList.add('active');
            lightStatus.textContent = "ON";
        } else {
            lightControl.classList.remove('active');
            lightStatus.textContent = "OFF";
        }
    }
    if (data.mode !== undefined) {
        modeToggle.checked = (data.mode === "Manual");
        if (data.mode === "Manual") {
            fanControl.classList.remove('disabled');
            lightControl.classList.remove('disabled');
        } else {
            fanControl.classList.add('disabled');
            lightControl.classList.add('disabled');
        }
    }

    // RFID updates (status messages)
    if (data.rfid_uid !== undefined) {
        rfidUid.textContent = data.rfid_uid;
        if (data.rfid_authorized === true) {
            rfidAccess.textContent = "Access Granted";
            rfidAccess.style.color = "#10b981";
        } else if (data.rfid_authorized === false) {
            rfidAccess.textContent = "Access Denied";
            rfidAccess.style.color = "#ef4444";
        }
    }
}

// UI actions
function toggleFan() {
    if (modeToggle.checked) {
        const message = new Paho.MQTT.Message("fan-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the fan.");
    }
}
function toggleLight() {
    if (modeToggle.checked) {
        const message = new Paho.MQTT.Message("light-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the light.");
    }
}
function toggleMode() {
    const message = new Paho.MQTT.Message("mode-toggle");
    message.destinationName = "project/control";
    client.send(message);
}

function showView(viewName) {
    if (viewName === 'dashboard') {
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('surveillance-view').style.display = 'none';
        document.getElementById('btn-dashboard').classList.add('active');
        document.getElementById('btn-surveillance').classList.remove('active');
    } else {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('surveillance-view').style.display = 'block';
        document.getElementById('btn-dashboard').classList.remove('active');
        document.getElementById('btn-surveillance').classList.add('active');
    }
}

// Video relay socket (same config as before)
const RENDER_BACKEND_URL = "https://live-videofeed.onrender.com";
const videoSocket = io(RENDER_BACKEND_URL);
videoSocket.on('new_frame_for_viewers', (data) => {
    liveFeed.src = 'data:image/jpeg;base64,' + data.frame;
});
videoSocket.on('connect', () => { liveFeed.alt = "Connected"; });
videoSocket.on('disconnect', () => { liveFeed.alt = "Disconnected"; });

// Start
window.addEventListener('load', () => {
    connectMqtt();
    modeToggle.addEventListener("change", toggleMode);
});
