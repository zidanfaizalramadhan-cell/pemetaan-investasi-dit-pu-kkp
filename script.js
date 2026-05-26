window.addEventListener('load', () => {
  const loader = document.getElementById('loader');

  setTimeout(() => {
    if (loader) {
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
    }
  }, 800);
});

/* =====================================================
   MAP INIT
===================================================== */

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  zoomSnap: 0.2,
  zoomDelta: 0.4
}).setView([-2.5, 118], 5);

const darkLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap & CartoDB'
  }
);

const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: '&copy; Esri World Imagery'
  }
);

darkLayer.addTo(map);

/* =====================================================
   CUSTOM MARKER
===================================================== */

const customIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div class="marker-wrapper">
      <div class="marker-pulse"></div>
      <div class="marker-dot"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -12]
});

/* =====================================================
   GLOBAL STATE
===================================================== */

let semuaData = [];
let markers = [];
let heatLayers = [];
let activeFilter = 'all';
let activeAdvancedFilter = '';
let activeMode = 'marine';
let investmentChart = null;
let selectedRegionName = null;

/* =====================================================
   DOM
===================================================== */

const searchInput = document.getElementById('searchInput');
const resultCount = document.getElementById('resultCount');
const regionList = document.getElementById('regionList');
const rankingList = document.getElementById('rankingList');

const darkMapBtn = document.getElementById('darkMapBtn');
const satelliteMapBtn = document.getElementById('satelliteMapBtn');
const resetMapBtn = document.getElementById('resetMapBtn');
const heatmapBtn = document.getElementById('heatmapBtn');
const printPdfBtn = document.getElementById('printPdfBtn');
const clearFilterBtn = document.getElementById('clearFilterBtn');

const sidebarToggle = document.getElementById('sidebarToggle');
const rightPanel = document.querySelector('.right-panel');

const filterButtons = document.querySelectorAll('.filter-btn');
const advancedFilterButtons = document.querySelectorAll('.advanced-filter-btn');
const navButtons = document.querySelectorAll('.nav-btn');

const analyticsPanel = document.querySelector('.analytics-panel');
const regionListPanel = document.querySelector('.region-list-wrapper');
const filterPanel = document.querySelector('.filter-row');
const advancedFilterPanel = document.querySelector('.advanced-filter-row');
const searchPanel = document.querySelector('.search-box-wrapper');
const mapToolsPanel = document.querySelector('.map-tools');
const resultInfoPanel = document.querySelector('.result-info');
const rankingPanel = document.querySelector('.ranking-panel');
const comparePanel = document.getElementById('comparePanel');
const investorPitch = document.getElementById('investorPitch');

const compareA = document.getElementById('compareA');
const compareB = document.getElementById('compareB');
const compareBtn = document.getElementById('compareBtn');
const compareResult = document.getElementById('compareResult');

/* =====================================================
   LOAD JSON
===================================================== */

fetch('investasi.json')
  .then(response => {
    if (!response.ok) {
      throw new Error(
        'investasi.json tidak ditemukan. Pastikan file investasi.json satu folder dengan index.html'
      );
    }

    return response.json();
  })
  .then(data => {
    semuaData = data.map(item => {
      const score = calculateInvestmentScore(item);

      return {
        ...item,
        score,
        priority: getPriorityLabel(score)
      };
    });

    populateCompareSelects();
    renderData(semuaData);
    createChart();
    updateAnalyticsByData(semuaData);
    updateStatCards(semuaData);
    updateFloatingDashboard(semuaData);

    if (semuaData.length > 0) {
      updateDetailPanel(semuaData[0]);
    }

    setTimeout(() => {
      map.invalidateSize(true);
    }, 300);

    console.log('Data investasi berhasil dimuat:', semuaData);
  })
  .catch(error => {
    console.error('Error loading JSON:', error);

    if (resultCount) {
      resultCount.innerText =
        'Data investasi gagal dimuat. Pastikan investasi.json satu folder dengan index.html';
    }
  });

/* =====================================================
   RENDER
===================================================== */

function renderData(dataArray) {
  tampilkanMarker(dataArray);
  tampilkanRegionList(dataArray);
  tampilkanRanking(dataArray);
  updateResultCount(dataArray);
  updateAnalyticsByData(dataArray);
  updateChartByData(dataArray);
  updateFloatingDashboard(dataArray);
  updateStatCards(dataArray);
}

/* =====================================================
   MARKERS
===================================================== */

function tampilkanMarker(dataArray) {
  markers.forEach(item => {
    map.removeLayer(item.marker);
  });

  markers = [];

  dataArray.forEach((data, index) => {
    const marker = L.marker(data.koordinat, {
      icon: customIcon,
      riseOnHover: true
    })
      .addTo(map)
      .bindPopup(createPopupContent(data), {
        maxWidth: 300,
        minWidth: 240,
        autoPan: false,
        keepInView: false,
        closeButton: true,
        offset: [0, -8]
      });

    marker.on('click', () => {
      pilihRegion(data, marker);
    });

    markers.push({
      marker,
      data,
      index
    });
  });
}

function createPopupContent(data) {
  return `
    <div class="popup-content">
      <h2>${data.nama}</h2>

      <p>
        <b>Main Commodity</b><br>
        ${data.komoditas}
      </p>

      <p>
        <b>Investment Score</b><br>
        ${data.score}/100 - ${data.priority}
      </p>

      <p>
        <b>Investment Potential</b><br>
        ${data.potensi}
      </p>

      <p>
        <b>Investment Value</b><br>
        ${data.nilai}
      </p>

      <p>
        <b>Export Market</b><br>
        ${data.ekspor}
      </p>

      <p>
        <b>ROI Estimate</b><br>
        ${data.roi}
      </p>
    </div>
  `;
}

/* =====================================================
   REGION LIST
===================================================== */

function tampilkanRegionList(dataArray) {
  if (!regionList) return;

  regionList.innerHTML = '';

  if (dataArray.length === 0) {
    regionList.innerHTML = `
      <div class="region-card">
        <h4>No region found</h4>
        <p>Try another keyword or filter category.</p>
      </div>
    `;

    return;
  }

  dataArray.forEach((data, index) => {
    const card = document.createElement('div');

    card.className = 'region-card';

    card.innerHTML = `
      <div class="region-card-top">
        <div>
          <span>${data.komoditas}</span>
          <h4>${data.nama}</h4>
        </div>

        <div class="region-value">
          ${data.score}/100
        </div>
      </div>

      <p>${data.potensi}</p>
    `;

    card.addEventListener('click', () => {
      const selectedMarker = markers.find(item => item.data.nama === data.nama);

      if (selectedMarker) {
        pilihRegion(data, selectedMarker.marker);
      }

      setActiveRegionCard(card);
    });

    regionList.appendChild(card);

    if (index === 0) {
      card.classList.add('active-region');
    }
  });
}

/* =====================================================
   RANKING
===================================================== */

function tampilkanRanking(dataArray) {
  if (!rankingList) return;

  const rankingData = [...dataArray]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  rankingList.innerHTML = '';

  if (rankingData.length === 0) {
    rankingList.innerHTML = `
      <div class="ranking-item">
        <h4>No ranking available</h4>
        <p>Try clearing the filters.</p>
      </div>
    `;

    return;
  }

  rankingData.forEach((data, index) => {
    const item = document.createElement('div');

    item.className = 'ranking-item';

    item.innerHTML = `
      <div class="ranking-top">
        <div>
          <span>#${index + 1} • ${data.komoditas}</span>
          <h4>${data.nama}</h4>
        </div>

        <div class="ranking-score">
          ${data.score}
        </div>
      </div>

      <p>
        ${data.priority} priority with ${data.roi} ROI and ${data.nilai} investment value.
      </p>
    `;

    item.addEventListener('click', () => {
      const selectedMarker = markers.find(markerItem => {
        return markerItem.data.nama === data.nama;
      });

      if (selectedMarker) {
        pilihRegion(data, selectedMarker.marker);
      }
    });

    rankingList.appendChild(item);
  });
}

/* =====================================================
   SELECT REGION
===================================================== */

function pilihRegion(data, marker) {
  selectedRegionName = data.nama;

  updateDetailPanel(data);
  setActiveMarker(marker);

  map.closePopup();

  const isPanelHidden = document.body.classList.contains('right-panel-hidden');
  const targetZoom = isPanelHidden ? 6.1 : 5.75;

  forceMapResize();

  const safeCenter = getSafePopupCenter(data.koordinat, targetZoom);

  map.flyTo(safeCenter, targetZoom, {
    duration: 0.55,
    easeLinearity: 0.22,
    noMoveStart: false
  });

  setTimeout(() => {
    forceMapResize();
    marker.openPopup();
  }, 620);

  const cards = document.querySelectorAll('.region-card');

  cards.forEach(card => {
    const title = card.querySelector('h4')?.innerText;

    if (title === data.nama) {
      setActiveRegionCard(card);

      card.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  });
}

function getSafePopupCenter(latlng, zoom) {
  const point = map.project(latlng, zoom);

  const isPanelHidden = document.body.classList.contains('right-panel-hidden');

  let offsetX = 0;
  let offsetY = 140;

  if (window.innerWidth > 1200) {
    offsetX = isPanelHidden ? 0 : 90;
    offsetY = isPanelHidden ? 135 : 170;
  }

  if (window.innerWidth <= 820) {
    offsetX = 0;
    offsetY = 110;
  }

  const safePoint = point.subtract([offsetX, offsetY]);

  return map.unproject(safePoint, zoom);
}

function forceMapResize() {
  map.invalidateSize(true);

  setTimeout(() => {
    map.invalidateSize(true);
  }, 80);

  setTimeout(() => {
    map.invalidateSize(true);
  }, 220);

  setTimeout(() => {
    map.invalidateSize(true);
  }, 420);
}

function setActiveMarker(selectedMarker) {
  markers.forEach(item => {
    const el = item.marker.getElement();

    if (el) {
      el.classList.remove('active-marker');
    }
  });

  const selectedEl = selectedMarker.getElement();

  if (selectedEl) {
    selectedEl.classList.add('active-marker');
  }
}

function setActiveRegionCard(selectedCard) {
  document.querySelectorAll('.region-card').forEach(card => {
    card.classList.remove('active-region');
  });

  selectedCard.classList.add('active-region');
}

/* =====================================================
   DETAIL PANEL
===================================================== */

function updateDetailPanel(data) {
  const detailTitle = document.getElementById('detailTitle');
  const detailDescription = document.getElementById('detailDescription');
  const detailCommodity = document.getElementById('detailCommodity');
  const detailValue = document.getElementById('detailValue');
  const detailExport = document.getElementById('detailExport');
  const detailROI = document.getElementById('detailROI');
  const detailScore = document.getElementById('detailScore');
  const detailScoreBar = document.getElementById('detailScoreBar');
  const detailPriority = document.getElementById('detailPriority');

  if (detailTitle) detailTitle.innerText = data.nama;
  if (detailDescription) detailDescription.innerText = data.deskripsi;
  if (detailCommodity) detailCommodity.innerText = data.komoditas;
  if (detailValue) detailValue.innerText = data.nilai;
  if (detailExport) detailExport.innerText = data.ekspor;
  if (detailROI) detailROI.innerText = data.roi;

  if (detailScore) {
    detailScore.innerText = `${data.score}/100`;
  }

  if (detailScoreBar) {
    detailScoreBar.style.width = `${data.score}%`;
  }

  if (detailPriority) {
    detailPriority.innerText = data.priority;
    detailPriority.classList.remove('medium', 'low');

    if (data.priority === 'Medium Priority') {
      detailPriority.classList.add('medium');
    }

    if (data.priority === 'Emerging Priority') {
      detailPriority.classList.add('low');
    }
  }
}

/* =====================================================
   SEARCH AND FILTER
===================================================== */

function applySearchAndFilter() {
  const filtered = getCurrentFilteredData();

  renderData(filtered);

  if (filtered.length > 0) {
    updateDetailPanel(filtered[0]);
  }
}

function getCurrentFilteredData() {
  const keyword = searchInput ? searchInput.value.toLowerCase() : '';

  return semuaData.filter(data => {
    const searchableText = `
      ${data.nama}
      ${data.komoditas}
      ${data.potensi}
      ${data.nilai}
      ${data.ekspor}
      ${data.roi}
      ${data.deskripsi}
      ${data.score}
      ${data.priority}
    `.toLowerCase();

    const matchKeyword = searchableText.includes(keyword);

    const matchFilter =
      activeFilter === 'all' ||
      searchableText.includes(activeFilter);

    const matchAdvanced = checkAdvancedFilter(data);

    return matchKeyword && matchFilter && matchAdvanced;
  });
}

function checkAdvancedFilter(data) {
  if (!activeAdvancedFilter) return true;

  if (activeAdvancedFilter === 'high-roi') {
    return parseROI(data.roi) > 20;
  }

  if (activeAdvancedFilter === 'value-billion') {
    return parseValueToNumber(data.nilai) >= 1000;
  }

  if (activeAdvancedFilter === 'export-japan') {
    return data.ekspor.toLowerCase().includes('japan');
  }

  if (activeAdvancedFilter === 'high-score') {
    return data.score >= 80;
  }

  return true;
}

if (searchInput) {
  searchInput.addEventListener('input', applySearchAndFilter);
}

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    filterButtons.forEach(btn => {
      btn.classList.remove('active-filter');
    });

    button.classList.add('active-filter');

    activeFilter = button.innerText.toLowerCase();

    applySearchAndFilter();
  });
});

advancedFilterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const clickedValue = button.dataset.advanced;

    if (activeAdvancedFilter === clickedValue) {
      activeAdvancedFilter = '';
      button.classList.remove('active-advanced-filter');
    } else {
      activeAdvancedFilter = clickedValue;

      advancedFilterButtons.forEach(btn => {
        btn.classList.remove('active-advanced-filter');
      });

      button.classList.add('active-advanced-filter');
    }

    applySearchAndFilter();
  });
});

/* =====================================================
   MAP TOOLS
===================================================== */

if (darkMapBtn) {
  darkMapBtn.addEventListener('click', () => {
    if (map.hasLayer(satelliteLayer)) {
      map.removeLayer(satelliteLayer);
    }

    if (!map.hasLayer(darkLayer)) {
      darkLayer.addTo(map);
    }

    darkMapBtn.classList.add('active-tool');
    satelliteMapBtn?.classList.remove('active-tool');
  });
}

if (satelliteMapBtn) {
  satelliteMapBtn.addEventListener('click', () => {
    if (map.hasLayer(darkLayer)) {
      map.removeLayer(darkLayer);
    }

    if (!map.hasLayer(satelliteLayer)) {
      satelliteLayer.addTo(map);
    }

    satelliteMapBtn.classList.add('active-tool');
    darkMapBtn?.classList.remove('active-tool');
  });
}

if (heatmapBtn) {
  heatmapBtn.addEventListener('click', () => {
    if (heatLayers.length > 0) {
      clearHeatmap();
      heatmapBtn.classList.remove('active-tool');
    } else {
      showHeatmap(getCurrentFilteredData());
      heatmapBtn.classList.add('active-tool');
    }
  });
}

if (resetMapBtn) {
  resetMapBtn.addEventListener('click', () => {
    resetDashboard();
  });
}

if (clearFilterBtn) {
  clearFilterBtn.addEventListener('click', () => {
    clearFiltersOnly();
  });
}

if (printPdfBtn) {
  printPdfBtn.addEventListener('click', () => {
    window.print();
  });
}

/* =====================================================
   HIDE / SHOW RIGHT PANEL FIX - STAY CURRENT MAP POSITION
===================================================== */

if (sidebarToggle && rightPanel) {
  sidebarToggle.addEventListener('click', () => {
    const willHide = !rightPanel.classList.contains('hide-right-panel');

    rightPanel.classList.toggle('hide-right-panel', willHide);
    sidebarToggle.classList.toggle('panel-hidden', willHide);
    document.body.classList.toggle('right-panel-hidden', willHide);

    sidebarToggle.innerText = willHide ? 'Show Panel' : 'Hide Panel';

    map.closePopup();

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    forceMapResize();

    setTimeout(() => {
      forceMapResize();

      map.setView(currentCenter, currentZoom, {
        animate: false
      });
    }, 420);
  });
}

/* =====================================================
   HEATMAP
===================================================== */

function showHeatmap(dataArray) {
  clearHeatmap();

  dataArray.forEach(data => {
    const value = parseValueToNumber(data.nilai);
    const score = data.score;

    const radius = Math.max(25000, value * 80);
    const opacity = Math.min(0.35, 0.12 + score / 400);

    const circle = L.circle(data.koordinat, {
      radius,
      color: '#00bfff',
      weight: 1,
      fillColor: '#00bfff',
      fillOpacity: opacity
    }).addTo(map);

    heatLayers.push(circle);
  });
}

function clearHeatmap() {
  heatLayers.forEach(layer => {
    map.removeLayer(layer);
  });

  heatLayers = [];
}

/* =====================================================
   NAV MODES
===================================================== */

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    navButtons.forEach(btn => {
      btn.classList.remove('active-btn');
    });

    button.classList.add('active-btn');

    const menu = button.innerText.toLowerCase();

    document.body.classList.remove('investor-access-mode');

    if (menu.includes('marine')) {
      showMarineMapMode();
    }

    if (menu.includes('analytics')) {
      showAnalyticsMode();
    }

    if (menu.includes('commodities')) {
      showCommodityMode();
    }

    if (menu.includes('investor')) {
      document.body.classList.add('investor-access-mode');
      showInvestorMode();
    }
  });
});

function showMarineMapMode() {
  activeMode = 'marine';

  showElement(searchPanel);
  showElement(filterPanel);
  showElement(advancedFilterPanel);
  showElement(mapToolsPanel);
  showElement(resultInfoPanel);
  showElement(rankingPanel);
  showElement(regionListPanel);
  showElement(comparePanel);
  hideElement(investorPitch);
  showElement(analyticsPanel);

  renderData(getCurrentFilteredData());

  map.closePopup();

  map.flyTo([-2.5, 118], 5, {
    duration: 0.8,
    easeLinearity: 0.18
  });
}

function showAnalyticsMode() {
  activeMode = 'analytics';

  hideElement(searchPanel);
  hideElement(filterPanel);
  hideElement(advancedFilterPanel);
  hideElement(mapToolsPanel);
  hideElement(resultInfoPanel);
  hideElement(regionListPanel);
  hideElement(investorPitch);

  showElement(analyticsPanel);
  showElement(rankingPanel);
  showElement(comparePanel);

  renderData(semuaData);

  map.closePopup();

  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  forceMapResize();

  setTimeout(() => {
    forceMapResize();
    map.setView(currentCenter, currentZoom, {
      animate: false
    });
  }, 250);
}

function showCommodityMode() {
  activeMode = 'commodities';

  hideElement(searchPanel);
  hideElement(filterPanel);
  hideElement(advancedFilterPanel);
  hideElement(mapToolsPanel);
  hideElement(resultInfoPanel);
  hideElement(rankingPanel);
  hideElement(comparePanel);
  hideElement(investorPitch);
  hideElement(analyticsPanel);

  showElement(regionListPanel);

  renderData(semuaData);

  map.closePopup();

  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  forceMapResize();

  setTimeout(() => {
    forceMapResize();
    map.setView(currentCenter, currentZoom, {
      animate: false
    });
  }, 250);
}

function showInvestorMode() {
  activeMode = 'investor';

  hideElement(searchPanel);
  hideElement(filterPanel);
  hideElement(advancedFilterPanel);
  hideElement(mapToolsPanel);
  hideElement(resultInfoPanel);
  hideElement(rankingPanel);
  hideElement(regionListPanel);
  hideElement(comparePanel);
  hideElement(analyticsPanel);

  showElement(investorPitch);

  const priorityRegions = semuaData
    .filter(data => data.score >= 80)
    .sort((a, b) => b.score - a.score);

  updateInvestorPitch(priorityRegions);

  map.closePopup();
  forceMapResize();

  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  setTimeout(() => {
    forceMapResize();
    map.setView(currentCenter, currentZoom, {
      animate: false
    });
  }, 250);
}

function showElement(element) {
  if (!element) return;

  element.style.display = '';
  element.style.opacity = '1';
  element.style.transform = 'translateY(0)';
}

function hideElement(element) {
  if (!element) return;

  element.style.opacity = '0';
  element.style.transform = 'translateY(10px)';

  setTimeout(() => {
    element.style.display = 'none';
  }, 180);
}

/* =====================================================
   RESET
===================================================== */

function resetDashboard() {
  activeMode = 'marine';
  selectedRegionName = null;

  map.closePopup();

  map.flyTo([-2.5, 118], 5, {
    duration: 0.9,
    easeLinearity: 0.18
  });

  if (searchInput) {
    searchInput.value = '';
  }

  activeFilter = 'all';
  activeAdvancedFilter = '';

  filterButtons.forEach(btn => {
    btn.classList.remove('active-filter');

    if (btn.innerText.toLowerCase() === 'all') {
      btn.classList.add('active-filter');
    }
  });

  advancedFilterButtons.forEach(btn => {
    btn.classList.remove('active-advanced-filter');
  });

  navButtons.forEach(btn => {
    btn.classList.remove('active-btn');

    if (btn.innerText.toLowerCase().includes('marine')) {
      btn.classList.add('active-btn');
    }
  });

  clearHeatmap();
  heatmapBtn?.classList.remove('active-tool');

  showMarineMapMode();

  renderData(semuaData);

  if (semuaData.length > 0) {
    updateDetailPanel(semuaData[0]);
  }
}

function clearFiltersOnly() {
  if (searchInput) {
    searchInput.value = '';
  }

  activeFilter = 'all';
  activeAdvancedFilter = '';

  filterButtons.forEach(btn => {
    btn.classList.remove('active-filter');

    if (btn.innerText.toLowerCase() === 'all') {
      btn.classList.add('active-filter');
    }
  });

  advancedFilterButtons.forEach(btn => {
    btn.classList.remove('active-advanced-filter');
  });

  renderData(semuaData);
}

/* =====================================================
   HERO BUTTONS
===================================================== */

document.querySelector('.primary-btn')?.addEventListener('click', () => {
  resetDashboard();
});

document.querySelector('.secondary-btn')?.addEventListener('click', () => {
  generateSimpleReport();
});

/* =====================================================
   ANALYTICS
===================================================== */

function updateResultCount(dataArray) {
  if (!resultCount) return;

  if (activeMode === 'analytics') {
    resultCount.innerText = `Analytics mode: ${dataArray.length} regions analyzed`;
    return;
  }

  if (activeMode === 'commodities') {
    resultCount.innerText = `Commodity mode: ${dataArray.length} regions available`;
    return;
  }

  if (activeMode === 'investor') {
    resultCount.innerText = `Investor access mode: ${dataArray.length} priority regions highlighted`;
    return;
  }

  if (dataArray.length === semuaData.length) {
    resultCount.innerText = `Showing all ${dataArray.length} investment regions`;
  } else {
    resultCount.innerText = `Showing ${dataArray.length} filtered investment regions`;
  }
}

function updateAnalyticsByData(dataArray) {
  const analyticsCards = document.querySelectorAll('.analytics-card');

  if (!analyticsCards.length) return;

  if (!dataArray.length) {
    analyticsCards.forEach(card => {
      const h3 = card.querySelector('h3');
      if (h3) h3.innerText = '-';
    });
    return;
  }

  const totalValue = dataArray.reduce((sum, item) => {
    return sum + parseValueToNumber(item.nilai);
  }, 0);

  const averageROI =
    dataArray.reduce((sum, item) => {
      return sum + parseROI(item.roi);
    }, 0) / dataArray.length;

  const commoditySummary = summarizeByCommodity(dataArray);

  const dominantSector =
    Object.entries(commoditySummary)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  const highestScore =
    [...dataArray].sort((a, b) => b.score - a.score)[0];

  if (analyticsCards[0]) {
    analyticsCards[0].querySelector('span').innerText = 'Total Investment Value';
    analyticsCards[0].querySelector('h3').innerText =
      `USD ${(totalValue / 1000).toFixed(2)}B`;
  }

  if (analyticsCards[1]) {
    analyticsCards[1].querySelector('span').innerText = 'Dominant Sector';
    analyticsCards[1].querySelector('h3').innerText = dominantSector;
  }

  if (analyticsCards[2]) {
    analyticsCards[2].querySelector('span').innerText = 'Average ROI';
    analyticsCards[2].querySelector('h3').innerText =
      `${averageROI.toFixed(1)}%`;
  }

  if (analyticsCards[3]) {
    analyticsCards[3].querySelector('span').innerText =
      'Highest Investment Score';
    analyticsCards[3].querySelector('h3').innerText =
      `${highestScore.nama} (${highestScore.score})`;
  }
}

function updateStatCards(dataArray) {
  const statTotalValue = document.getElementById('statTotalValue');
  const statRegions = document.getElementById('statRegions');
  const statAvgRoi = document.getElementById('statAvgRoi');
  const statCommodities = document.getElementById('statCommodities');

  if (!dataArray.length) {
    if (statTotalValue) statTotalValue.innerText = 'USD 0B';
    if (statRegions) statRegions.innerText = '0';
    if (statAvgRoi) statAvgRoi.innerText = '0%';
    if (statCommodities) statCommodities.innerText = '0';
    return;
  }

  const totalValue = dataArray.reduce((sum, item) => {
    return sum + parseValueToNumber(item.nilai);
  }, 0);

  const averageROI =
    dataArray.reduce((sum, item) => {
      return sum + parseROI(item.roi);
    }, 0) / dataArray.length;

  const commodityGroups = new Set(
    dataArray.map(item => getCommodityGroup(item.komoditas))
  );

  if (statTotalValue) {
    statTotalValue.innerText = `USD ${(totalValue / 1000).toFixed(2)}B`;
  }

  if (statRegions) {
    statRegions.innerText = dataArray.length;
  }

  if (statAvgRoi) {
    statAvgRoi.innerText = `${averageROI.toFixed(1)}%`;
  }

  if (statCommodities) {
    statCommodities.innerText = commodityGroups.size;
  }
}

function updateFloatingDashboard(dataArray) {
  const miniRegions = document.getElementById('miniRegions');
  const miniValue = document.getElementById('miniValue');
  const miniROI = document.getElementById('miniROI');

  if (!dataArray.length) {
    if (miniRegions) miniRegions.innerText = '0';
    if (miniValue) miniValue.innerText = 'USD 0B';
    if (miniROI) miniROI.innerText = '0%';
    return;
  }

  const totalValue = dataArray.reduce((sum, item) => {
    return sum + parseValueToNumber(item.nilai);
  }, 0);

  const averageROI =
    dataArray.reduce((sum, item) => {
      return sum + parseROI(item.roi);
    }, 0) / dataArray.length;

  if (miniRegions) miniRegions.innerText = dataArray.length;
  if (miniValue) miniValue.innerText = `USD ${(totalValue / 1000).toFixed(2)}B`;
  if (miniROI) miniROI.innerText = `${averageROI.toFixed(1)}%`;
}

/* =====================================================
   CHART
===================================================== */

function createChart() {
  const chartCanvas = document.getElementById('investmentChart');

  if (!chartCanvas || typeof Chart === 'undefined') return;

  const ctx = chartCanvas.getContext('2d');

  investmentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: semuaData.map(item => item.nama.split(',')[0]),
      datasets: [
        {
          label: 'Investment Value USD Million',
          data: semuaData.map(item => parseValueToNumber(item.nilai)),
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'rgba(255,255,255,0.75)'
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.65)'
          },
          grid: {
            color: 'rgba(255,255,255,0.06)'
          }
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.65)'
          },
          grid: {
            color: 'rgba(255,255,255,0.06)'
          }
        }
      }
    }
  });
}

function updateChartByData(dataArray) {
  if (!investmentChart) return;

  investmentChart.data.labels = dataArray.map(item => item.nama.split(',')[0]);
  investmentChart.data.datasets[0].data = dataArray.map(item => {
    return parseValueToNumber(item.nilai);
  });

  investmentChart.update();
}

/* =====================================================
   COMPARE
===================================================== */

function populateCompareSelects() {
  if (!compareA || !compareB) return;

  compareA.innerHTML = '';
  compareB.innerHTML = '';

  semuaData.forEach((data, index) => {
    const optionA = document.createElement('option');
    const optionB = document.createElement('option');

    optionA.value = data.nama;
    optionA.textContent = data.nama;

    optionB.value = data.nama;
    optionB.textContent = data.nama;

    compareA.appendChild(optionA);
    compareB.appendChild(optionB);

    if (index === 1) {
      optionB.selected = true;
    }
  });
}

if (compareBtn) {
  compareBtn.addEventListener('click', () => {
    compareRegions();
  });
}

function compareRegions() {
  if (!compareA || !compareB || !compareResult) return;

  const dataA = semuaData.find(item => item.nama === compareA.value);
  const dataB = semuaData.find(item => item.nama === compareB.value);

  if (!dataA || !dataB) return;

  compareResult.innerHTML = `
    <div class="compare-row">
      <div class="compare-box">
        <span>Region A</span>
        <h4>${dataA.nama}</h4>
      </div>

      <div class="compare-box">
        <span>Region B</span>
        <h4>${dataB.nama}</h4>
      </div>
    </div>

    <div class="compare-row">
      <div class="compare-box">
        <span>Investment Value</span>
        <h4>${dataA.nilai}</h4>
      </div>

      <div class="compare-box">
        <span>Investment Value</span>
        <h4>${dataB.nilai}</h4>
      </div>
    </div>

    <div class="compare-row">
      <div class="compare-box">
        <span>ROI</span>
        <h4>${dataA.roi}</h4>
      </div>

      <div class="compare-box">
        <span>ROI</span>
        <h4>${dataB.roi}</h4>
      </div>
    </div>

    <div class="compare-row">
      <div class="compare-box">
        <span>Score</span>
        <h4>${dataA.score}/100</h4>
      </div>

      <div class="compare-box">
        <span>Score</span>
        <h4>${dataB.score}/100</h4>
      </div>
    </div>
  `;
}

/* =====================================================
   INVESTOR PITCH
===================================================== */

function updateInvestorPitch(priorityRegions) {
  if (!investorPitch) return;

  investorPitch.innerHTML = `
    <div class="section-header">
      <h3>Investor Access</h3>
      <span>Contact Point</span>
    </div>

    <div class="compare-result">
      <div class="compare-box">
        <span>Name</span>
        <h4>Rikzan</h4>
      </div>

      <div class="compare-box">
        <span>Email</span>
        <h4>
          <a href="mailto:rikzanf@gmail.com" class="contact-link">
            rikzanf@gmail.com
          </a>
        </h4>
      </div>

      <div class="compare-box">
        <span>Phone / WhatsApp</span>
        <h4>
          <a href="https://wa.me/6285704004318" target="_blank" class="contact-link">
            +6285704004318
          </a>
        </h4>
      </div>

      <div class="compare-box">
        <span>Support Area</span>
        <h4>Marine Investment Facilitation</h4>
      </div>
    </div>
  `;
}

/* =====================================================
   UTILS
===================================================== */

function parseValueToNumber(value) {
  if (!value) return 0;

  const lower = value.toLowerCase();
  const number = parseFloat(lower.replace(/[^0-9.]/g, ''));

  if (Number.isNaN(number)) return 0;

  if (lower.includes('billion')) {
    return number * 1000;
  }

  if (lower.includes('million')) {
    return number;
  }

  return number;
}

function parseROI(value) {
  if (!value) return 0;

  const number = parseFloat(value.replace(/[^0-9.]/g, ''));

  return Number.isNaN(number) ? 0 : number;
}

function getCommodityGroup(commodity) {
  const text = commodity.toLowerCase();

  if (text.includes('tuna')) return 'Tuna';
  if (text.includes('seaweed')) return 'Seaweed';
  if (text.includes('shrimp')) return 'Shrimp';
  if (text.includes('crab')) return 'Crab';
  if (text.includes('tourism')) return 'Tourism';
  if (text.includes('logistics')) return 'Logistics';
  if (text.includes('fisheries')) return 'Fisheries';

  return 'Others';
}

function calculateInvestmentScore(data) {
  const value = parseValueToNumber(data.nilai);
  const roi = parseROI(data.roi);

  const valueScore = Math.min(value / 20, 50);
  const roiScore = Math.min(roi * 1.6, 40);

  let sectorScore = 6;

  const sector = data.komoditas.toLowerCase();

  if (
    sector.includes('tuna') ||
    sector.includes('seaweed') ||
    sector.includes('shrimp') ||
    sector.includes('logistics') ||
    sector.includes('tourism')
  ) {
    sectorScore = 10;
  }

  return Math.round(Math.min(valueScore + roiScore + sectorScore, 100));
}

function getPriorityLabel(score) {
  if (score >= 80) return 'High Priority';
  if (score >= 65) return 'Medium Priority';
  return 'Emerging Priority';
}

function summarizeByCommodity(dataArray) {
  const summary = {};

  dataArray.forEach(data => {
    const group = getCommodityGroup(data.komoditas);

    if (!summary[group]) {
      summary[group] = 0;
    }

    summary[group] += parseValueToNumber(data.nilai);
  });

  return summary;
}

/* =====================================================
   RESIZE FIX
===================================================== */

window.addEventListener('resize', () => {
  setTimeout(() => {
    forceMapResize();
  }, 250);
});

setTimeout(() => {
  forceMapResize();
}, 1000);

/* =====================================================
   FORCE MOBILE UI CLEAN
===================================================== */

function forceMobileCleanUI() {
  const isMobile = window.innerWidth <= 900;

  const sidebarToggleEl = document.getElementById('sidebarToggle');
  const floatingDashboardEl = document.querySelector('.floating-dashboard');

  if (isMobile) {
    if (sidebarToggleEl) {
      sidebarToggleEl.style.display = 'none';
      sidebarToggleEl.style.visibility = 'hidden';
      sidebarToggleEl.style.opacity = '0';
      sidebarToggleEl.style.pointerEvents = 'none';
    }

    if (floatingDashboardEl) {
      floatingDashboardEl.style.display = 'none';
      floatingDashboardEl.style.visibility = 'hidden';
      floatingDashboardEl.style.opacity = '0';
      floatingDashboardEl.style.pointerEvents = 'none';
    }

    document.body.classList.add('mobile-clean-mode');
  } else {
    if (sidebarToggleEl) {
      sidebarToggleEl.style.display = '';
      sidebarToggleEl.style.visibility = '';
      sidebarToggleEl.style.opacity = '';
      sidebarToggleEl.style.pointerEvents = '';
    }

    if (floatingDashboardEl) {
      floatingDashboardEl.style.display = '';
      floatingDashboardEl.style.visibility = '';
      floatingDashboardEl.style.opacity = '';
      floatingDashboardEl.style.pointerEvents = '';
    }

    document.body.classList.remove('mobile-clean-mode');
  }

  forceMapResize();
}

window.addEventListener('load', forceMobileCleanUI);
window.addEventListener('resize', forceMobileCleanUI);
window.addEventListener('orientationchange', forceMobileCleanUI);

setTimeout(forceMobileCleanUI, 500);
setTimeout(forceMobileCleanUI, 1200);
