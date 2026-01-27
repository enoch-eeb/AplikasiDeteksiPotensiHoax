// --- VARIABLES & SELECTORS ---
const loadingText = document.getElementById("loading-text");
let pdfExportCounter = 1;

// --- UTILS: MODAL ERROR ---
function tampilkanModalError(message) {
    const modalErrorMessage = document.getElementById('modalErrorMessage');
    const errorModal = document.getElementById('errorModal');
    
    if (modalErrorMessage && errorModal) {
        modalErrorMessage.textContent = message;
        errorModal.classList.add('visible');
    } else {
        alert(message);
    }
}

function sembunyikanModalError() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.classList.remove('visible');
    }
}

// --- NAVBAR RESPONSIVE ---
document.addEventListener('DOMContentLoaded', function() {   
    const hamburgerButton = document.getElementById('hamburger-menu');
    const navigationLinks = document.getElementById('nav-links');

    if (hamburgerButton && navigationLinks) {
        hamburgerButton.addEventListener('click', () => {
            navigationLinks.classList.toggle('active');
            // Animasi hamburger bar (opsional)
            const bars = hamburgerButton.querySelectorAll('.bar');
            bars[0].style.transform = navigationLinks.classList.contains('active') ? 'rotate(45deg) translate(5px, 6px)' : 'none';
            bars[1].style.opacity = navigationLinks.classList.contains('active') ? '0' : '1';
            bars[2].style.transform = navigationLinks.classList.contains('active') ? 'rotate(-45deg) translate(5px, -6px)' : 'none';
        });
    }
});

// --- MAIN FUNCTION: CEK HOAX ---
async function cekHoax() {
    const judul = document.getElementById("judul").value;
    const isi = document.getElementById("isi").value;
    const inputSection = document.getElementById("input-section");
    const hasilSection = document.getElementById("hasil-section");
    const loading = document.getElementById("loading");

    if (!judul || !isi) {
        tampilkanModalError("Mohon lengkapi Judul dan Isi berita terlebih dahulu!");
        return;
    }

    if (loadingText) loadingText.textContent = "Sedang menganalisis berita...";
    if (loading) loading.style.display = "flex";

    try {
        const response = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: judul, content: isi })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server Error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        const confidence = data.confidence.toFixed(2);
        const label = data.label;

        let kategoriText = "";
        let warna = "";
        let saranText = "";
        let saranColor = "";

        // Logika warna & teks
        if (label === "Valid") {
            kategoriText = "Berita Valid";
            warna = "#27ae60"; // Green modern
            saranText = "Berita ini terdeteksi valid. Namun, tetap disarankan untuk memverifikasi dari sumber lain.";
            saranColor = "rgba(39, 174, 96, 0.1)"; // Light green bg
        } else {
            kategoriText = "Potensi Hoaks Tinggi";
            const g = Math.floor(165 - (165 * data.confidence));
            warna = "#e74c3c"; // Red modern
            saranText = "Hati-hati! Berita ini memiliki indikasi kuat sebagai hoaks. Jangan disebarkan sebelum diverifikasi.";
            saranColor = "rgba(231, 76, 60, 0.1)"; // Light red bg
        }

        // Transisi tampilan
        inputSection.style.display = "none";
        hasilSection.style.display = "flex";
        
        // Render Hasil (Glass Style)
        hasilSection.innerHTML = `
        <div class="hasil-card glass-card" id="hasil-pdf">
            <div class="hasil-kiri">
                <h4>${judul || "(Judul Berita)"}</h4>
                ${isi ? `<div class="isi-berita-desktop">${isi}</div>` : ""}
                
                <div class="saran" style="background: ${saranColor}; color: ${warna === '#27ae60' ? '#1e8449' : '#c0392b'}; border: 1px solid ${warna}">
                    ${saranText}
                </div>

                <div class="hasil-tombol-grup" id="analisis-lagi-grup">
                    <button class="btn-primary-glass" onclick="resetForm()" style="margin-top:20px; width:auto;">
                        🔄 Analisis Lagi
                    </button>
                </div>
            </div>

            <div class="hasil-kanan">
                <p style="font-size:0.9rem; color:#666;">Hasil Deteksi:</p>
                <p class="kategori" style="color:${warna}">${kategoriText}</p>
                
                <canvas id="chart" width="180" height="180"></canvas>
                
                <p style="margin-top:10px; font-size:0.9rem;">Tingkat Keyakinan:</p>
                <p><strong style="font-size:1.5rem; color:#2c3e50;">${confidence}%</strong></p>

                <button class="button-sekunder-hasil" id="export-pdf-button" onclick="exportToPDF()">
                     📄 Simpan PDF
                </button>
            </div>
        </div>
        `;

        // Render Chart
        renderChart(confidence, label, warna);

    } catch (error) {
        tampilkanModalError(error.message);
    } finally {
        loading.style.display = "none";
    }
}

function renderChart(confidence, label, colorHex) {
    const ctx = document.getElementById("chart").getContext("2d");
    const value = confidence / 100;
    
    ctx.clearRect(0, 0, 180, 180);

    // Background Circle
    ctx.beginPath();
    ctx.arc(90, 90, 70, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    ctx.lineWidth = 15;
    ctx.stroke();

    // Value Circle
    ctx.beginPath();
    ctx.arc(90, 90, 70, -Math.PI / 2, (2 * Math.PI * value) - Math.PI / 2);
    ctx.strokeStyle = colorHex; 
    ctx.lineWidth = 15;
    ctx.lineCap = "round"; // Round edges style
    ctx.stroke();

    // Text Center
    ctx.font = "bold 24px Inter";
    ctx.fillStyle = "#2c3e50";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(confidence + "%", 90, 90);
}

function resetForm() {
    const inputSection = document.getElementById("input-section");
    const hasilSection = document.getElementById("hasil-section");
    
    // Simple fade effect
    hasilSection.style.opacity = '0';
    setTimeout(() => {
        hasilSection.style.display = "none";
        hasilSection.style.opacity = '1';
        
        inputSection.style.display = "block";
        inputSection.style.animation = "slideUp 0.5s ease";
        
        document.getElementById("judul").value = "";
        document.getElementById("isi").value = "";
    }, 300);
}

// --- PDF EXPORT FUNCTION ---
function exportToPDF() {
    const loading = document.getElementById("loading");
    if (loadingText) loadingText.textContent = "Menyiapkan dokumen PDF...";
    if (loading) loading.style.display = 'flex';

    const element = document.getElementById('hasil-pdf');
    const tombolAnalisisGrup = document.getElementById('analisis-lagi-grup');
    const tombolExport = document.getElementById('export-pdf-button');
    const bodyElement = document.body;

    // Generate Filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,"");
    const namaFile = `DeteksiHoaks_Report_${dateStr}_${pdfExportCounter}.pdf`;
    pdfExportCounter++;

    // Hide Buttons
    if (tombolAnalisisGrup) tombolAnalisisGrup.style.display = 'none';
    if (tombolExport) tombolExport.style.display = 'none';

    // Add classes for clean styling (remove glass effect for PDF)
    element.classList.add('export-mode'); 
    bodyElement.classList.add('pdf-export-active');

    const opt = {
        margin:      10,
        filename:    namaFile,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Delay slighty to allow CSS to repaint
    setTimeout(() => {
        html2pdf().from(element).set(opt).save()
        .then(() => {
            // Restore UI
            if (tombolAnalisisGrup) tombolAnalisisGrup.style.display = 'flex';
            if (tombolExport) tombolExport.style.display = 'block';
            element.classList.remove('export-mode');
            bodyElement.classList.remove('pdf-export-active');
            if (loading) loading.style.display = 'none';
        })
        .catch(err => {
            console.error(err);
            tampilkanModalError('Gagal ekspor PDF.');
            if (loading) loading.style.display = 'none';
            // Restore UI on error
            element.classList.remove('export-mode');
            bodyElement.classList.remove('pdf-export-active');
            if (tombolAnalisisGrup) tombolAnalisisGrup.style.display = 'flex';
            if (tombolExport) tombolExport.style.display = 'block';
        });
    }, 500);
}

// --- SCRAPE MODAL ---
function bukaModalScrape() {
    const modal = document.getElementById('scrapeModal');
    if (modal) modal.classList.add('visible');
}

function tutupModalScrape() {
    const modal = document.getElementById('scrapeModal');
    if (modal) modal.classList.remove('visible');
    document.getElementById('url-input-modal').value = '';
}

async function jalankanScrape() {
    const urlInput = document.getElementById('url-input-modal');
    const url = urlInput.value;
    const judulInput = document.getElementById('judul');
    const isiInput = document.getElementById('isi');
    const loading = document.getElementById("loading");

    if (!url) {
        alert("Mohon masukkan URL berita!");
        return;
    }

    tutupModalScrape();

    if (loadingText) loadingText.textContent = "Mengambil data dari URL...";
    if (loading) loading.style.display = "flex";

    try {
        const response = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal mengambil berita");

        judulInput.value = data.title || "";
        isiInput.value = data.content || "";

        // Efek visual sukses
        judulInput.style.backgroundColor = "rgba(168, 230, 163, 0.3)";
        setTimeout(() => {
            judulInput.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        }, 1000);

    } catch (error) {
        tampilkanModalError("Gagal mengambil berita: " + error.message);
    } finally {
        if (loading) loading.style.display = "none";
    }
}