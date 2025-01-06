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

const baseUrl = 'https://run-gemini.onrender.com/';  
// const baseUrl = 'http://localhost:3000/';
const promptLimit = 5;

const $tripName = document.querySelector('.gp-trip-name');
const $travelDates = document.querySelector('.gp-date');
// const $inpPrompts = document.querySelectorAll('.gp-form .gp-input:not(.gp-textarea)');
const $attrCheckboxes = document.querySelectorAll('.gp-checkbox input');
const $otherAttr = document.querySelector('#other-attractions');
// const $hotelInp = document.querySelector('#gp-hotel');
const $submitBtn = document.querySelector('.gp-prompt-btn');
const $prompt = document.querySelector('.gp-prompt span');
const $result = document.querySelector('.gp-result');
const $gpScrollToTryOutBtn = document.querySelector('.gp-try-out-scroll-to-btn');
const $gpTryOutInp = document.querySelector('.gp-try-out-input');
const $gpTryOutRes = document.querySelector('.gp-try-out-result');
const $gpTryOutPromptBtn = document.querySelector('.gp-try-out-btn');
const $maxedOutDisplay = document.querySelector('.gp-max-out');
const $firstTimeRadios = document.querySelectorAll('[gp-wrap="gp-first-timer-wrap"] input[type=radio]');
const $travelWithRadios = document.querySelectorAll('[gp-wrap="gp-travel-with-wrap"] input[type=radio]');
const $occasionRadios = document.querySelectorAll('[gp-wrap="gp-occasion-wrap"] input[type=radio]');

// !function resetLocalStorage() {
//     for (const name of Object.keys(localStorage)) {
//         if (!name.startsWith('gp-')) continue; 
//         localStorage.removeItem(name);
//     }
// }();

const fp = flatpickr('.gp-date', {
    mode: 'range',
    altInput: true,
    enableTime: true,
    altFormat: 'D M j',
    dateFormat: 'Y-m-d',
    onClose: (selectedDates, dateStr, instance) => {
        if (!selectedDates.length) return;

        const startDay = new Date(selectedDates[0]).toDateString(); // + ' ' + new Date(selectedDates[0]).toTimeString().split('GMT')[0].trim(); 
        const endDay = new Date(selectedDates[1]).toDateString(); // + ' ' + new Date(selectedDates[1]).toTimeString().split('GMT')[0].trim(); 
        const days = `'${startDay}' to '${endDay}'`;

        const dayCount = getDays(dateStr); 

        localStorage['gp-days'] = days; 
        localStorage['gp-dayCount'] = dayCount; 
    },
});

!function populateFieldsFromLocalStorage() {
    const { 
        'gp-trip-name':tripName, 
        'gp-days':days, 
        'gp-hotel':hotel, 
        'gp-firstTime':firstTime, 
        'gp-travelWith':travelWith,
        'gp-occasion':occasion,
        'gp-attractions':attractions, 
        'gp-other-attractions':otherAttr 
    } = localStorage;

    $tripName.value = tripName || '';
    $travelDates.nextElementSibling.value = days?.replaceAll(/'|"/g,'') || '';
    [...$firstTimeRadios].filter(r => r.value.toLowerCase().trim().includes(firstTime))?.[0]?.click();
    [...$travelWithRadios].filter(r => r.value.toLowerCase().trim().includes(travelWith))?.[0]?.click();
    [...$occasionRadios].filter(r => r.value.toLowerCase().trim().includes(occasion))?.[0]?.click();

    $attrCheckboxes.forEach(checkbox => {
        const name = checkbox.closest('label').querySelector('span').textContent.trim();
    });

    if (attractions && attractions.trim()) {
        JSON.parse(attractions).forEach(attraction => {
            [...$attrCheckboxes].filter(r => r.name.toLowerCase().trim().includes(attraction))?.[0]?.click();
        });
    }

    $otherAttr.value = otherAttr || '';
}();

function getDays(dateStr) {
    const startDate = dateStr.split('to')[0].trim(); 
    const endDate = dateStr.split('to')[1].trim(); 
    const days = Math.ceil( ( new Date(endDate).getTime() - new Date(startDate).getTime() ) / (1000 * 60 * 60 * 24) ) + 1; 

    return days;
}

$tripName.addEventListener('change', e => {
    handleInpChange(e); 
});

$otherAttr.addEventListener('change', e => {
    handleInpChange(e); 
});

function handleInpChange(e) {
    const name = e.currentTarget.name.trim().toLowerCase();
    const val = e.currentTarget.value.trim();
    if (!name) return;
    const storeName = `gp-${name}`;
    localStorage[storeName] = val;   
}

$firstTimeRadios.forEach(btn => {
    handleRadioSaveToLocalStorage(btn, 'gp-firstTime');
}); 

$travelWithRadios.forEach(btn => {
    handleRadioSaveToLocalStorage(btn, 'gp-travelWith');
});

$occasionRadios.forEach(btn => {
    handleRadioSaveToLocalStorage(btn, 'gp-occasion');
});

function handleRadioSaveToLocalStorage(btn, section) {
    btn.addEventListener('click', e => {
        localStorage[section] = btn.value.toLowerCase().trim();
    });
} 

$attrCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('click', () => {
        const attractions = localStorage['gp-attractions'] ? JSON.parse(localStorage['gp-attractions']) : []; 
        const checkboxName = checkbox.name; // format(checkbox.name);
        if (checkbox.checked) {
            attractions.push(checkboxName);
        }
        else {
            attractions.splice(attractions.indexOf(checkboxName), 1);
        }
        localStorage['gp-attractions'] = JSON.stringify(attractions); 
    });
});

async function createUserInFirebase(userMail) {
    if (!userMail) return;
    const userRef = doc(db, 'travelData', `user-${userMail}`);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) return;
    await setDoc(userRef, { createdAt: serverTimestamp() }); 
} 

function generatePrompt() {
    let { city, days, dayCount, hotel, attractions, otherAttractions, firstTime, travelWith, occasion } = processLocalStorageForPrompt();
    const newYorkCoords = '{"lat":40.706005,"lng":-74.008827}'; 
// (from ${days}) 
// 'Day, Month Date Year': {
// Pay attention to the dates to determine the season and recommend appropriate activities.
    //const prompt = `Create a ${dayCount} day plan for ${firstTime}${city}${travelWith}${occasion} that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants. 
    const prompt = `Create a ${dayCount} day plan that runs from ${days}.
    The day plan is for ${firstTime}${city}${travelWith}${occasion} that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants. 
    Recommend appropriate activities based on the seasons of the year that fall on the dates ${days}.
    Make sure the holidays fall on their respective dates, for instance Christmas on 25th December, New Year's Eve on 31st December, and New Years on 1st January.
    When you do not have a specific recommendation for the placeName add in "ask a local" in the day's description and use the coordinates ${newYorkCoords}.
    Make sure to fill each day's title and description with appropriate content and make it sound like a story.
    IMPORTANT: The output should be a syntactically correct JSON object of ${dayCount} days.
    Make sure the JSON is valid.
    Example output:
        {
            Day 1: {
                date: 'YYYY-MM-DD',
                morning: {
                    title: string,
                    description: string, 
                    placeName: string,
                    coordinates: [lat,lng]
                },
                afternoon: {
                    title: string,
                    description: string, 
                    placeName: string,
                    coordinates: [lat,lng]
                },
                evening: {
                    title: string,
                    description: string, 
                    placeName: string,
                    coordinates: [lat,lng]
                }
            },
            Day 2: {...}
        }
    `;

    const displayPrompt = ` Create a ${dayCount} day plan for ${firstTime}${city}${travelWith}${occasion} that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants.`;

    let savePrompt = '';
    if (days) {
        days = days.split('to');
        let arrival = new Date(days[0]);
        let depart = new Date(days[1]);
        arrival = arrival.toString(); //`${arrival.toDateString()} ${arrival.toLocaleTimeString()}`;
        depart = depart.toString(); // `${depart.toDateString()} ${depart.toLocaleTimeString()}`;

        savePrompt = `Create a <b>${dayCount} day (<i>${arrival} to ${depart}</i>)</b> day plan for <b>${firstTime}${city}${travelWith}${occasion}</b> that includes <b>${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''}</b> and restaurants. 
        Make it sound like a story.
        Pay attention to the dates to determine the season and recommend appropriate activities.
        When you do not have a specific recommendation say "ask a local".`;
    }
        
    return { prompt, displayPrompt, savePrompt }; 
} 

function processLocalStorageForPrompt() {
    const city = localStorage['gp-city'] || 'NYC';
    const days = localStorage['gp-days'] || 1;
    const dayCount = localStorage['gp-dayCount'] || 1;
    const hotel = localStorage['gp-hotel'] || 'hotels';
    let attractions = localStorage['gp-attractions'] 
    ? JSON.parse(localStorage['gp-attractions'])//.join(', ') 
    : ''; 

    if (attractions) {
        attractions = attractions.map(attraction => format(attraction)).join(', ');
    }

    let otherAttractions = localStorage['gp-other-attractions'] || ''; 
    if (otherAttractions) otherAttractions = otherAttractions.split(/\n|,/).filter(x => x.trim()).join(', '); 

    const firstTime = localStorage['gp-firstTime'] && localStorage['gp-firstTime'] === 'yes' ? 'a first time visitor to ' : '';

    let travelWith = localStorage['gp-travelWith'] || '';
    if (travelWith) {
        travelWith = travelWith.includes('partner') ? ' with my partner' : ` with ${travelWith}`;
    } 

    let occasion = localStorage['gp-occasion'] || '';
    if (occasion) {
        occasion = !occasion.includes('none') && !occasion.includes('other occasion') ? ` for a ${occasion}` : '';  
    }

    return { city, days, dayCount, hotel, attractions, otherAttractions, firstTime, travelWith, occasion };
}

function format(str) {
    return str = str.trim().split('-').map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

$gpScrollToTryOutBtn.addEventListener('click', e => {
    $gpTryOutRes.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
});

$gpTryOutPromptBtn.addEventListener('click', async e => {
    e.preventDefault();

    const prompt = $gpTryOutInp.value.trim();
    if (!prompt) return;

    const gpTryOutPromptBtnVal = $gpTryOutPromptBtn.value;
    $gpTryOutPromptBtn.value = 'Loading...';
    $gpTryOutRes.innerHTML = '';
    $gpTryOutRes.classList.add('spinner');

    const result = await postTextPrompt(prompt); 

    $gpTryOutRes.classList.remove('spinner');
    $gpTryOutRes.innerHTML = result.replace(/\*+/g, '<br>');
    $gpTryOutPromptBtn.value = gpTryOutPromptBtnVal;
});

async function postTextPrompt(prompt) {
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            payload: prompt,
            // tryOut: true,
        })
    });

    return res.text();
} 

$submitBtn.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit();
});

async function handleSubmit() {
    const proceed = await preprocess();
    console.log('proceed', proceed)
    if (!proceed) return;

    const userMail = getUserMail();
    const submitBtnVal = $submitBtn.value;
    $submitBtn.value = 'Loading...';
    $result.innerHTML = '';
    $result.classList.add('spinner');
    $result.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    $map.classList.add('hide');

    const { prompt, displayPrompt, savePrompt } = generatePrompt();

    console.log('prompt:::', prompt)

    let result = {}; 
    
    try {
        result = await postPrompt(prompt); 
    }
    catch(e) {
        const errorMsg = e.message;
        alertUserNSaveMsg(errorMsg);
        return; 
    }

    console.log('result:::', result)

    let resultObj = {}; 
    // resultObj = isObject(checkJSON(result)) ? JSON.parse(result) : JSON.parse(result += '}'); // gemini been returning an unclosed parent object

    try {
        if ( isObject(checkJSON(result)) ) {
            resultObj = JSON.parse(result);
        }
        else {
            resultObj = JSON.parse(result += '}');
        }
    }
    catch(e) {
        const errorMsg = `MALFORMED OBJECT: ${e.message}`;
        alertUserNSaveMsg(errorMsg);
        return; 
    }

    $prompt.textContent = displayPrompt; 

    console.log('resultObj:::', resultObj)

    let entireDayPlan = '',
        markerCoords = [],
        markersInfo = [];

    for(let [day, timeslots] of Object.entries(resultObj)) {
        const { date, morning, afternoon, evening } = timeslots;
        const markerInfoObj = { date, morning, afternoon, evening };

        const newYorkCoords = { lat: 40.706005, lng: -74.008827 };
        const morningCoords = morning?.coordinates?.lat ? morning?.coordinates : newYorkCoords;
        const afteCoords = afternoon?.coordinates?.lat ? afternoon?.coordinates : newYorkCoords;
        const eveCoords = evening?.coordinates?.lat ? evening?.coordinates : newYorkCoords;

        // console.log('morning?.coordinates', morning?.coordinates)
        // console.log('afternoon?.coordinates', afternoon?.coordinates)
        // console.log('evening?.coordinates', evening?.coordinates)

        markersInfo.push(markerInfoObj);
        markerCoords.push(morningCoords, afteCoords, eveCoords);

        entireDayPlan += getDayPlanHTMLStr(markerInfoObj);
    }

    populateResults(entireDayPlan); 

    console.log('markerCoords', markerCoords)
    $map.classList.remove('hide');
    initMap(markerCoords); 

    saveMarkersInfoNPromptToDB(userMail, savePrompt, markersInfo); 

    function alertUserNSaveMsg(msg) {
        alertUser(msg); 
        saveErrorMsgToDB(userMail, msg);
    }

    async function saveErrorMsgToDB(userMail, errorMsg) {
        const userRef = doc(db, 'travelData', `user-${userMail}`); 
        const addedAt = serverTimestamp(); 
        const errObj = { addedAt, errorMsg, prompt };
        await updateDoc(userRef, { promptErrors: arrayUnion(errObj) }); 
    }
    
    function alertUser(msg) {
        const res = `
                    <div class=""><b> >> Failed to fetch, please reload page & try again!</b></div>
                    <div><i>${msg}</i></div>
                    `;
        populateResults(res); 
    }

    function populateResults(res='') {
        $result.classList.remove('spinner');
        $result.innerHTML = res; 
        $submitBtn.value = submitBtnVal;
    }

    async function preprocess() {
        const userMail = getUserMail(); 
        if (!userMail) return;

        const data = await getUserMailData(userMail); 
        const { prompts } = data; 

        if ( prompts && prompts.length >= promptLimit ) {
            $maxedOutDisplay.classList.remove('hide');
            $maxedOutDisplay.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            const $form = document.querySelector('#wf-form-Trip-Name');
            $form.classList.add('shade');
            setTimeout(()=>$form.classList.remove('shade'),1000);

            $result.innerHTML = '';
            $map.classList.add('hide');

            return;
        }

        $maxedOutDisplay.classList.add('hide');
        
        if (!$tripName.value.trim() || !$travelDates.value.trim()) {
            if (!$tripName.value.trim()) {
                $tripName.classList.add('highlight');
                $tripName.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(()=>$tripName.classList.remove('highlight'),1000);
            }
            else {
                const $pickerEl = $travelDates.nextElementSibling;
                $pickerEl.classList.add('highlight');
                $pickerEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(()=>$pickerEl.classList.remove('highlight'),1000);
            }

            return;
        }

        return true;
    }

    async function getUserMailData(userMail) {
        const userRef = doc(db, 'travelData', `user-${userMail}`); 
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            createUserInFirebase(userMail);
            return {}; 
        }
        return docSnap.data(); 
    }

    function getUserMail() {
        return Clerk?.user?.externalAccounts?.[0]?.emailAddress || localStorage['gp-userMail'];
    }

    function isObject(obj) {
        return obj === Object(obj) && Object.prototype.toString.call(obj) !== '[object Array]';
    }

    function checkJSON(json) {
        let res;
        try {
            res = JSON.parse(json);
        }
        catch(e) {
            res = e.message;
        }
        return res;
    }

    async function saveMarkersInfoNPromptToDB(userMail, savePrompt, markersInfo) {
        if (!Object.keys(markersInfo).length) return;
        // await saveMarkersToFirebase(userMail, markersInfo);

        // console.log('=========================')
        // console.log('userMail', userMail)
        // console.log('savePrompt', savePrompt)
        // console.log('markersInfo', markersInfo)
        // console.log('=========================')
    
        await savePromptToDB(userMail, savePrompt); 
    }

    async function savePromptToDB(userMail, savePrompt) {
        const userRef = doc(db, 'travelData', `user-${userMail}`); 
        await updateDoc(userRef, { prompts: arrayUnion(savePrompt) }); 
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

    function getDayPlanHTMLStr(markerInfoObj) {
        let { date, morning, afternoon, evening } = markerInfoObj; 

        console.log('markerInfoObj:::', markerInfoObj)

        // console.log(`dayDate.trim().startsWith('"')`, dayDate.trim().startsWith('"'))

        /*if (dayDate.trim() 
            && (dayDate.trim().startsWith('"') 
            || dayDate.trim().startsWith("'") 
            || dayDate.trim().startsWith("\""))) {
            dayDate = dayDate.replaceAll('"','').replaceAll("'","").replaceAll("\"",""); 
        }*/

        // console.log('dayDate NEW::::', dayDate)

        date = new Date(date).toUTCString();
        date = `${date.substring(0,3)}, ${date.substring(4, 16)}`;

        const morningTitle = morning?.title,
              morningDesc = morning?.description,
              afteTitle = afternoon?.title,
              afteDesc = afternoon?.description,
              eveTitle = evening?.title,
              eveDesc = evening?.description;

        const showWholeday = () => morningTitle || afteTitle || eveTitle;
        const showMorning = () => morningTitle && morningTitle.trim().toLowerCase() !== 'n/a';
        const showAfternoon = () => afteTitle && afteTitle.trim().toLowerCase() !== 'n/a';
        const showEvening = () => eveTitle && eveTitle.trim().toLowerCase() !== 'n/a';

        return `<div class="margin-top-20">
                    <div class="day">${date}</div> 
                    ${showWholeday() ? `<div class="gp-day-events">
                        ${showMorning() ? `<div>
                            <div class="gp-header">Morning</div>
                            <div class="gp-title">${morningTitle || '<i>No result</i>'}</div>
                            <div class="gp-desc">${morningDesc || '<i>No result</i>'}</div>
                        </div>` : ''}
                        ${showAfternoon() ? `<div>
                            <div class="gp-header">Afternoon</div>
                            <div class="gp-title">${afteTitle || '<i>No result</i>'}</div>
                            <div class="gp-desc">${afteDesc || '<i>No result</i>'}</div>
                        </div>` : ''} 
                        ${showEvening() ? `<div>
                            <div class="gp-header">Evening</div>
                            <div class="gp-title">${eveTitle || '<i>No result</i>'}</div>
                            <div class="gp-desc">${eveDesc || '<i>No result</i>'}</div>
                        </div>  ` : ''}  
                    </div>` : '<div class="gp-day-events"><i>No results</i></div>'}
                </div>`;
    }
}

async function saveMarkersToFirebase(userMail, markers) {
    if (!userMail) return; 

    let dbSubCollection = 'default_trip';

    if (localStorage['gp-trip-name']) {
        const tripName = localStorage['gp-trip-name'];
        dbSubCollection = tripName.replace(/([^a-z|0-9|-|'|~|\.|\!|\*|\(|\)]+)/igm, '_');
    }

    const userRef = doc(db, 'travelData', `user-${userMail}`, dbSubCollection, 'doc1'); 

    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, { createdAt: serverTimestamp() }); 

        const userSubCollectionNamesRef = doc(db, 'travelData', `user-${userMail}`);
        await updateDoc(userSubCollectionNamesRef, { subNames: arrayUnion(dbSubCollection) }); 
    }

    const days = [];

    markers.forEach(marker => {
        const { dayDate, morning, afternoon, evening } = marker;

        const morningEvent = {
            dayEventName: morning.placeName || '',
            title: morning.title || '',
            lat: morning.coordinates[0] || 0,
            lng: morning.coordinates[1] || 0,
            timeslot: 'morning',
        };
    
        const afternoonEvent = {
            dayEventName: afternoon.placeName || '',
            title: afternoon.title || '',
            lat: afternoon.coordinates[0] || 0,
            lng: afternoon.coordinates[1] || 0,
            timeslot: 'afternoon',
        };
    
        const eveningEvent = {
            dayEventName: evening.placeName || '',
            title: evening.title || '',
            lat: evening.coordinates[0] || 0,
            lng: evening.coordinates[1] || 0,
            timeslot: 'evening',
        };

        const obj = {
            dayDate,
            events: [morningEvent, afternoonEvent, eveningEvent],
            summary: '',
        }

        days.push(obj);
    });

    const saveObj = {}; 
    saveObj.days = days;  
    saveObj.modifiedAt = serverTimestamp(); 
    await updateDoc(userRef, saveObj);
}

/*
!async function x() {
    const userRef = doc(db, 'travelData', `user-muijemuije24@gmail.com`); 
    const docSnap = await getDoc(userRef);
    const data = await docSnap.data(); 

    const { prompts } = data; 

    console.log('See prompts test:::', prompts)
}();
*/ 

// Google Map

// Initialize and add the map
const $map = document.querySelector('.gp-map');
let map;
let marker;
let infoWindow;

// initMap(); 

async function initMap(markerCoords=[]) {
    // The map location
    const nycLat = 40.706005;
    const nycLng = -74.008827;
    const newYorkCoords = { lat: nycLat, lng: nycLng };

    // Request needed libraries
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

    // const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
    //     google.maps.importLibrary("marker"),
    //     google.maps.importLibrary("places"),
    //   ]);
      

    // The map, centered at location
    // map = new Map($map, {
    map = new google.maps.Map($map, {
        zoom: 12,
        center: newYorkCoords,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
    });


    const bounds = new google.maps.LatLngBounds();
    const iconUrl = 'https://cdn.prod.website-files.com/6666bd4119f3f071441485fe/66dec46b646f9970dd5a15e7_camera.png';

    // The marker, positioned at Uluru
    // const marker = new AdvancedMarkerElement({
    //     map: map,
    //     position: position,
    //     title: "Uluru",
    // });

    markerCoords.forEach(pair => {
        const { lat, lng } = pair;
        // if (lat === nycLat && lng === nycLng) return;  // skip nyc center coords

        const marker = createMarker(pair); 
        // console.log('Marker:', marker)
        // console.log('Marker.position', marker.position)

        if (lat === 0 || lng === 0) return;
        if (marker && marker.position) bounds.extend(marker.position);
    });

    map.fitBounds(bounds);

    function createMarker({lat, lng}) {
        // const lat = position[0],
        //         lng = position[1];

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

    /**
     * Autocomplete    
    */
}

!async function setupHotelAutocompleteInp() {
    await google.maps.importLibrary('places');

    // Create the input HTML element, and append it.
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: {country: ['us']},
    });

    // document.body.appendChild(placeAutocomplete); 
    const $hotelWrap = document.querySelector('.gp-hotel-inp');
    $hotelWrap.appendChild(placeAutocomplete);

    // Add the gmp-placeselect listener, and display the results.
    placeAutocomplete.addEventListener('gmp-placeselect', async ({ place }) => {
        await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location'],
        });

        const res = place.toJSON(); 
        const hotel = res.displayName;
        console.log(res);

        localStorage['gp-hotel'] = hotel;
    });
}(); 
