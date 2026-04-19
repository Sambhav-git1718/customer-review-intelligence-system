let globalReviewData = []; // Stores the original data for live filtering
let sentimentChartInstance = null;
let ratingChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const mainHeader = document.getElementById('main-header');
    
    // ==========================================
    // 1. Tab Navigation & Dynamic Header
    // ==========================================
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            // Remove active classes
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            document.getElementById(item.getAttribute('data-target')).classList.add('active');
            
            // Update the main header text automatically
            mainHeader.innerText = item.innerText;
        });
    });

    // ==========================================
    // 2. Fetch Dashboard KPIs & Charts
    // ==========================================
    fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
            if(data.error) return;
            
            // Update KPIs
            document.getElementById('kpi-total').innerText = data.total_reviews || 0;
            document.getElementById('kpi-rating').innerText = (data.average_rating || 0) + " / 5";
            document.getElementById('kpi-positive').innerText = data.sentiments['Positive'] || 0;
            document.getElementById('kpi-negative').innerText = data.sentiments['Negative'] || 0;

            // Initialize Sentiment Doughnut Chart
            const ctxSent = document.getElementById('sentimentChart').getContext('2d');
            if(sentimentChartInstance) sentimentChartInstance.destroy();
            sentimentChartInstance = new Chart(ctxSent, {
                type: 'doughnut',
                data: {
                    labels: ['Positive', 'Negative', 'Neutral'],
                    datasets: [{
                        data: [
                            data.sentiments['Positive'] || 0, 
                            data.sentiments['Negative'] || 0, 
                            data.sentiments['Neutral'] || 0
                        ],
                        backgroundColor: ['#03DAC6', '#CF6679', '#B3B3B3'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: {color: '#fff'} } } }
            });

            // Initialize Rating Bar Chart
            const ratingCanvas = document.getElementById('ratingChart');
            if (ratingCanvas) {
                const ctxRate = ratingCanvas.getContext('2d');
                if (ratingChartInstance) ratingChartInstance.destroy();
                
                const ratingLabels = data.ratings ? Object.keys(data.ratings).map(k => k + ' Stars') : [];
                const ratingValues = data.ratings ? Object.values(data.ratings) : [];

                ratingChartInstance = new Chart(ctxRate, {
                    type: 'bar',
                    data: {
                        labels: ratingLabels,
                        datasets: [{
                            label: 'Reviews',
                            data: ratingValues,
                            backgroundColor: '#BB86FC',
                            borderRadius: 4
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { ticks: { color: '#B3B3B3' }, grid: { color: '#333' } },
                            x: { ticks: { color: '#B3B3B3' }, grid: { display: false } }
                        }
                    }
                });
            }
        })
        .catch(err => console.error("Error loading stats:", err));

    // ==========================================
    // 3. Fetch Data Table & Setup Filters
    // ==========================================
    fetch('/reviews')
        .then(res => res.json())
        .then(data => {
            globalReviewData = data; // Save to global variable for filtering
            renderTable(globalReviewData); // Initial load
        })
        .catch(err => console.error("Error loading reviews:", err));

    const searchInput = document.getElementById('searchInput');
    const sentimentFilter = document.getElementById('sentimentFilter');

    function renderTable(dataToDisplay) {
        const tbody = document.querySelector('#full-reviews-table tbody');
        if (!tbody) return; // Safety check

        tbody.innerHTML = ''; 

        if (dataToDisplay.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No matching reviews found.</td></tr>';
            return;
        }

        dataToDisplay.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold; min-width: 80px;">⭐ ${r.rating || 'N/A'}</td>
                <td class="tag-${r.sentiment}">${r.sentiment}</td>
                <td>${r.review_text}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedSentiment = sentimentFilter.value;

        const filtered = globalReviewData.filter(r => {
            const textMatch = (r.review_text || "").toLowerCase().includes(searchTerm);
            const sentimentMatch = (selectedSentiment === 'All') || (r.sentiment === selectedSentiment);
            return textMatch && sentimentMatch;
        });

        renderTable(filtered);
    }

    // Attach listeners for live filtering
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (sentimentFilter) sentimentFilter.addEventListener('change', applyFilters);

    // ==========================================
    // 4. Fetch Insights & Reports
    // ==========================================
    fetch('/report')
        .then(res => res.json())
        .then(data => {
            if(data.error) return;

            // Inject Keywords
            const kwContainer = document.getElementById('keyword-container');
            if (kwContainer && data.top_keywords) {
                kwContainer.innerHTML = data.top_keywords.map(kw => `
                    <div class="keyword-tag">${kw.keyword} <span class="kw-count">${kw.count}</span></div>
                `).join('');
            }

            // Inject Sentiment Breakdown List
            const breakdown = document.getElementById('sentiment-breakdown-list');
            if (breakdown && data.sentiment_analysis && data.sentiment_analysis.distribution_percentage) {
                const dist = data.sentiment_analysis.distribution_percentage;
                const counts = data.sentiment_analysis.counts;
                breakdown.innerHTML = `
                    <li><span class="dot" style="background: #03DAC6"></span> <strong>Positive:</strong> ${dist.Positive || 0}% (${counts.Positive || 0} reviews)</li>
                    <li><span class="dot" style="background: #CF6679"></span> <strong>Negative:</strong> ${dist.Negative || 0}% (${counts.Negative || 0} reviews)</li>
                    <li><span class="dot" style="background: #B3B3B3"></span> <strong>Neutral:</strong> ${dist.Neutral || 0}% (${counts.Neutral || 0} reviews)</li>
                `;
            }
        })
        .catch(err => console.error("Error loading reports:", err));
});