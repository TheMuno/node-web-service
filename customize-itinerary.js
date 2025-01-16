let map;
const locatonNYC = { lat: 40.7580, lng: -73.9855 };
const markerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/677cc99549bcbb38edad633e_pin24.png';
const $timeslots = document.querySelectorAll('[data-ak-timeslots]');
const $morningTimeslotWrap = document.querySelector('[data-ak-timeslots] [data-ak-timeslot-wrap="morning"]');
const $afternoonTimeslotWrap = document.querySelector('[data-ak-timeslots] [data-ak-timeslot-wrap="afternoon"]');
const $eveningTimeslotWrap = document.querySelector('[data-ak-timeslots] [data-ak-timeslot-wrap="evening"]');

!async function initMap() {
  const $map = document.querySelector('.map');
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  map = new google.maps.Map($map, {
    zoom: 12,
    center: locatonNYC,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  }); 

  if (localStorage['ak-attractions']) {
    const attractions = JSON.parse(localStorage['ak-attractions'])
    attractions.forEach(attraction => {
      let { name, coords } = attraction;

      addAttractionToList(name, $morningTimeslotWrap, coords);

      if (coords && coords.trim() && Number(coords.trim().split(',')?.[0])) {
        coords = coords.trim().split(',');
        if (coords.length) {
          const lat = Number(coords[0]);
          const lng = Number(coords[1]);
          createMarker(name, {lat, lng});
        }   
      }
      else {
        const request = {
          textQuery: name, 
          fields: ['displayName', 'formattedAddress', 'location'],
          locationBias: locatonNYC,
          language: 'en-US',
          maxResultCount: 10,
          region: 'us',
          useStrictTypeFiltering: false,
        };

        name = name.trim().toLowerCase();

        if (name.includes('restaurant') || name.includes('steak')) {
          request.includedType = 'restaurant';
        }
        else if (name.includes('hotel')) {
          request.includedType = 'lodging';
        }
        else if (name.includes('shop')) {
          request.includedType = 'shopping';
        }

        findPlaces(request); 
      }
    });
  }
}(); 

function addAttractionToList(name, $listName, coords=true) {
  if (coords === '') return; 
  name = format(name); 
  const $location = $listName.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link"]').textContent = name;
  $listName.append($location);
}

function createMarker(title, position) {
  const markerPinImg = document.createElement('img');
  markerPinImg.src = markerPinUrl;
    const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title,
        content: markerPinImg,
        gmpClickable: true,
    });

    marker.addListener('gmp-click', ({ domEvent, latLng }) => {
        // const { target } = domEvent;
        
        infoWindow.close();
        infoWindow.setContent(marker.title);
        infoWindow.open(marker.map, marker);
    });
} 

if (localStorage['ak-travel-days']) {
  const { flatpickrDate, usrInpDate:travelDates } = JSON.parse(localStorage['ak-travel-days']);
  const $titleTravelDates = document.querySelector('[data-ak="title-travel-dates"]');
  const $timeslotsDay = document.querySelector('[data-ak="timeslots-day"]');
  const $timeslotsDate = document.querySelector('[data-ak="timeslots-date"]');

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let [ firstDate, lastDate ] = flatpickrDate.split(/\s+to\s+/);
  firstDate = `${monthArr[firstDate.getMonth()]} ${firstDate.getDate()}`;
  lastDate = `${monthArr[lastDate.getMonth()]} ${lastDate.getDate()}`;

  const titleDates = `${firstDate} - ${lastDate}`;
  
  $titleTravelDates.textContent = titleDates;
  
  /*
  const date1 = flatpickrDate.split(/\s+to\s+/)[0];
  const startDate = new Date(date1);
  
  const day = daysArr[startDate.getDay()];
  const month = monthArr[startDate.getMonth()];
  const theDate = startDate.getDate();
  const theYear = startDate.getFullYear();
  
  $timeslotsDay.textContent = day;
  $timeslotsDate.textContent = `${month} ${theDate}, ${theYear}`;
  */
}

const $tripTitle = document.querySelector('[data-ak="trip-title"]');
if (localStorage['ak-user-name']) {
  let name = localStorage['ak-user-name'];
  name = name.split(/\s+/)[0];
  const occasion = localStorage['ak-occasion'] ? format(localStorage['ak-occasion']) : '';
  $tripTitle.textContent = `${name}'s ${occasion ? `${occasion} ` : ''}Trip`;
}
else if (!localStorage['ak-user-name'] && localStorage['ak-occasion']) {
  const occasion = format(localStorage['ak-occasion']); 
  $tripTitle.textContent = `${occasion} Trip`;
}
else if (!localStorage['ak-user-name'] && !localStorage['ak-occasion']) {
	$tripTitle.textContent = 'Trip Info';
}

function format(str) {
  return str = str.trim().split(/\s+/).map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function findPlaces(request) {
  const { Place } = await google.maps.importLibrary('places');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  
  const { places } = await Place.searchByText(request);

  if (places.length) {
    console.log('places::', places);

    const { LatLngBounds } = await google.maps.importLibrary('core'); 
    const bounds = new LatLngBounds();

    // Loop through and get all the results.
    places.forEach((place) => {
      const { displayName, location } = place;
      createMarker(displayName, location);
      // map.setCenter({lat, lng});

      bounds.extend(place.location);

      addAttractionToList(displayName, $morningTimeslotWrap); 
    });
    map.fitBounds(bounds);
  } else {
    console.log('No results');
  }
} 

!async function setupAutocompleteInp() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: {country: ['us']},
  });

  const $hotelWrap = document.querySelector('.ak-autocomplete');
  $hotelWrap.appendChild(placeAutocomplete);

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-placeselect', async ({ place }) => {
      await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
      });

      const res = place.toJSON(); 
      // const hotel = res.displayName;
      console.log('Autocomplete Res::', res);
      
      const { displayName, location: { lat, lng } } = res; 

      createMarker(displayName, {lat, lng});

      const $activeTimeslot = document.querySelector('[data-ak-timeslots].active');
      if ($activeTimeslot) {
        const $activeTimeslotWrap = $activeTimeslot.querySelector('[data-ak-timeslot-wrap]'); 
        if ($activeTimeslot.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
          $activeTimeslot.querySelector('[data-ak-timeslot-title]').click(); 
        }

        addAttractionToList(displayName, $activeTimeslotWrap);
      }
      else {
        const $firstTimeslot = $morningTimeslotWrap.closest('[data-ak-timeslots]'); 
        if ($firstTimeslot.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
          $firstTimeslot.querySelector('[data-ak-timeslot-title]').click(); 
        }

        addAttractionToList(displayName, $morningTimeslotWrap); 
      }
  });
}();   

$timeslots.forEach(timeslot => {
    const $title = timeslot.querySelector('[data-ak-timeslot-title]');
    $title.addEventListener('click', e => {
        document.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
        timeslot.classList.add('active');
    });
}); 

document.body.addEventListener('click', e => {
  if (e.target.closest('[data-ak="locations-slider"]')) return;
  document.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
});

function reInitWebflow() {
  Webflow.destroy();
  Webflow.ready();
  Webflow.require('ix2').init(); 
}
