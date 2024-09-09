import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, 
    getDocs, updateDoc, deleteField, collection,
    arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);   

const baseUrl = 'https://run-gemini.onrender.com/'; // 'http://localhost:3000/'; 

(function resetLocalStorage() {
    localStorage.removeItem('days');
    localStorage.removeItem('hotel');
    localStorage.removeItem('attractions');
    localStorage.removeItem('other-attractions');
})();

const $userMail = document.querySelector('.gp-user-email');
if (localStorage.userMail) {
    $userMail.value = localStorage.userMail;
}
$userMail.addEventListener('change', e => {
    localStorage.userMail = e.currentTarget.value; 
});

const fp = flatpickr('.gp-date', {
    mode: 'range',
    altInput: true,
    enableTime: true,
    altFormat: 'D M j',
    dateFormat: 'Y-m-d',
    onClose: (selectedDates, dateStr, instance) => {
    if (!selectedDates.length) return;
    // appendTravelDates(selectedDates);
    const days = getDays(dateStr); 
    localStorage.days = days; 
    },
});

function getDays(dateStr) {
    const startDate = dateStr.split('to')[0].trim(); 
    const endDate = dateStr.split('to')[1].trim(); 
    const days = Math.ceil( ( new Date(endDate).getTime() - new Date(startDate).getTime() ) / (1000 * 60 * 60 * 24) ) + 1; 

    return days;
}

function generatePrompt() {
    const days = localStorage.days || 1;
    const hotel = localStorage.hotel || 'hotels';
    const attractions = JSON.parse(localStorage.attractions).join(', ') || ''; 
    let otherAttractions = localStorage['other-attractions'] || ''; 
    if (otherAttractions) otherAttractions = otherAttractions.split(/\n|,/).filter(x => x.trim()).join(', '); 
    const str = ` Create a ${days} day plan for NYC that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants 
    in the format
        { 
        Day 1: {
            morning: {
                description: '', 
                coordinates: [lat,lng]
            },
            afternoon: {
                description: '', 
                coordinates: [lat,lng]
            },
            evening: {
                description: '', 
                coordinates: [lat,lng]
            }
        } 
    }`;
        
    // the place names and their coordinates should be wrapped in brackets ()`;
    // with Google Map coordinates for each place wrapped in []
    return str; 
}

const $inpPrompts = document.querySelectorAll('.gp-form .gp-input:not(.gp-textarea)');
const $otherAttr = document.querySelector('#other-attractions');
const $attrCheckboxes = document.querySelectorAll('.gp-checkbox input');
const $submitBtn = document.querySelector('.gp-btn');
const $prompt = document.querySelector('.gp-prompt span');
const $result = document.querySelector('.gp-result');

$inpPrompts.forEach(inp => {
    inp.addEventListener('change', e => {
    handleInpChange(e);
    });
});

$otherAttr.addEventListener('change', e => {
    handleInpChange(e); 
});

function handleInpChange(e) {
    const name = e.currentTarget.name;
    if (!name) return;
    localStorage[name] = e.currentTarget.value;   
}

$attrCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('click', () => {
    const attractions = localStorage.attractions ? JSON.parse(localStorage.attractions) : []; 
    const checkboxName = format(checkbox.name);
    if (checkbox.checked) {
        attractions.push(checkboxName);
    }
    else {
        attractions.splice(attractions.indexOf(checkboxName), 1);
    }
    localStorage.attractions = JSON.stringify(attractions); 
    });
});

function format(str) {
    return str = str.trim().split('-').map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

$submitBtn.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit();
});

async function handleSubmit() {
    if ([...$inpPrompts].filter(i => i.value.trim() === '').length) return;
    const prompt = generatePrompt(); 
    $prompt.textContent = prompt.substring(0, prompt.indexOf('in the format'));

    console.log('Payload:', prompt)

    $result.innerHTML = '';

    const result = await postPrompt(prompt); 
    // $result.textContent = result.info; 

    const resultObj = JSON.parse(result);
    console.log(resultObj)

    let entireDayPlan = '',
    markers = [];
    for(let [day, times] of Object.entries(resultObj)) {
        const { morning, afternoon, evening } = times;

        markers.push(morning.coordinates, afternoon.coordinates, evening.coordinates);

        entireDayPlan += `<div class="margin-top-20">
                            <div class="day">${day}</div> 
                            <div>
                                <div><b>Morning:</b> ${morning.description}</div>
                                <div><b>Afternoon:</b> ${afternoon.description}</div>
                                <div><b>Evening:</b> ${evening.description}</div>    
                            </div>
                        </div>`;
    }

    $result.innerHTML = entireDayPlan; 

    console.log('markers', markers)
    initMap(markers); 

    if (!localStorage.userMail) return; 
    saveMarkerToFirebase(localStorage.userMail, markers); 
}

async function postPrompt(prompt) {
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            payload: prompt
        })
    });

    return res.json();
} 

// Google Map

// Initialize and add the map
const $map = document.querySelector('.gp-map');
let map;

async function initMap(markers) {
    // The location of Uluru
    const position = { lat: 40.706005, lng: -74.008827 };
    // Request needed libraries.
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // The map, centered at Uluru
    map = new Map($map, {
        zoom: 10,
        center: position,
        mapId: "DEMO_MAP_ID",
    });

    const bounds = new google.maps.LatLngBounds();
    const iconUrl = 'https://cdn.prod.website-files.com/6666bd4119f3f071441485fe/66dec46b646f9970dd5a15e7_camera.png';

    // The marker, positioned at Uluru
    // const marker = new AdvancedMarkerElement({
    //     map: map,
    //     position: position,
    //     title: "Uluru",
    // });

    markers.forEach(markerCoords => {
        const marker = createMarker(markerCoords); 
        // console.log('Marker:', marker)
        // console.log('Marker.position', marker.position)
        bounds.extend(marker.position);
    });

    map.fitBounds(bounds);

    function createMarker(position) {
        const lat = position[0],
                lng = position[1];

        if (!lat || !lng) return;

        const iconImage = document.createElement('img');
        iconImage.className = 'gp-map-icon';
        iconImage.src = iconUrl;

        const marker = new AdvancedMarkerElement({
            map: map,
            position: new google.maps.LatLng(lat, lng),
            content: iconImage,
            // gmpClickable: true,
            // title: "Uluru",
        });

        /*marker.addListener("click", ({ domEvent, latLng }) => {
            const { target } = domEvent;
        
            infoWindow.close();
            infoWindow.setContent(marker.title);
            infoWindow.open(marker.map, marker);
        });*/

        return marker; 
    }
}

async function saveMarkerToFirebase(userMail, markers) {  
    const userData = doc(db, 'geminiData', `user-${userMail}`); 
    const docSnap = await getDoc(userData);
    const data = await docSnap.data(); 
    
    // const currentMarkers = data.markers; 

    const saveObj = {}; 
    saveObj.markers = JSON.stringify(markers);  

    saveObj.modifiedAt = serverTimestamp();

    await setDoc(userData, saveObj);
}
