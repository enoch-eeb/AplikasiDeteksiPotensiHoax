const loadingText = document.getElementById("loading-text");
let pdfExportCounter = 1;

//pop up error
function tampilkanModalError(message) {
  if (modalErrorMessage && errorModal) {
      modalErrorMessage.textContent = message;
      errorModal.classList.add('visible');
  } else {
      alert(message);
  }
}
function sembunyikanModalError() {
  if (errorModal) {
      errorModal.classList.remove('visible');
  }
}

document.addEventListener('DOMContentLoaded', function() {   
  const hamburgerButton = document.getElementById('hamburger-menu');
  const navigationLinks = document.getElementById('nav-links');

  if (hamburgerButton && navigationLinks) {
      hamburgerButton.addEventListener('click', () => {
          navigationLinks.classList.toggle('active');
      });
  } else {
      console.warn('Peringatan: Tombol hamburger atau menu tautan tidak ditemukan di halaman ini.');
  }
});

const accordions = document.querySelectorAll('.accordion-button');

    accordions.forEach(button => {
        button.addEventListener('click', () => {
            
            button.classList.toggle('active');
    
            const panel = button.nextElementSibling;
            
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                panel.style.maxHeight = panel.scrollHeight + "px";
            } 
        });
    });

async function cekHoax() {
  const judul = document.getElementById("judul").value;
  const isi = document.getElementById("isi").value;
  const inputSection = document.getElementById("input-section");
  const hasilSection = document.getElementById("hasil-section");
  const loading = document.getElementById("loading");

  if (!judul || !isi) {
    tampilkanModalError("Judul dan Isi berita wajib diisi!");
    return;
  }

  if (loadingText) loadingText.textContent = "Analisis berita sedang diproses...";
    if (loading) loading.style.display = "flex";

  try {
    //fetch API
     const response = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        title: judul, 
        content: isi 
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error: ${response.statusText}`);
    }

    const data = await response.json();
    const confidence = data.confidence.toFixed(2);
    const label = data.label;

    let kategoriText = "";
    let warna = "";
    let saranText = "";

    if (label === "Valid") {
      kategoriText = "Berita Valid";
      warna = "green";
      saranText = "Berita ini terdeteksi valid. Namun, tetap disarankan untuk cross check ulang kebenarannya dari berbagai sumber.";
    } else {
      kategoriText = "Potensi Hoaks Tinggi";
      const g = Math.floor(165 - (165 * data.confidence));
      warna = `rgb(255,${g},0)`;
      saranText = "Berita ini berpotensi hoaks. Cek kebenarannya kembali sebelum percaya!.";
    }

    inputSection.style.display = "none";
    hasilSection.style.display = "flex";
    hasilSection.innerHTML = `
  <div class="hasil-card" id="hasil-pdf">
    <div class="hasil-kiri">
      <h4>${judul || "(Judul Berita)"}</h4>
      ${isi ? `<p class="isi-berita-desktop">${isi}</p>` : ""}
      <div class="saran">${saranText}</div>

      <div class="hasil-tombol-grup" id="analisis-lagi-grup">
        <button class="button-utama-hasil" onclick="resetForm()">Analisis Lagi</button>
      </div>
    </div>

    <div class="hasil-kanan">
      <p>Kategori :</p>
      <p class="kategori" style="color:${warna}">${kategoriText}</p>
      <canvas id="chart" width="180" height="180"></canvas>
      <p>Confidence Score:</p>
      <p><strong>${confidence}%</strong></p>

      <button class="button-sekunder-hasil" id="export-pdf-button" onclick="exportToPDF()">
          Export ke PDF
      </button>
    </div>
  </div>
  `;

    //donut chart
    const ctx = document.getElementById("chart").getContext("2d");
    const value = confidence / 100;
    ctx.clearRect(0, 0, 180, 180);

    ctx.beginPath();
    ctx.arc(90, 90, 70, 0, 2 * Math.PI);
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 20;
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, 0, 180, 0);
    if (label === "Valid") {
      grad.addColorStop(0, "#a8e6a3");
      grad.addColorStop(1, "#008000");
    } else {
      grad.addColorStop(0, "#ffa500");
      grad.addColorStop(1, "#ff0000");
    }

    ctx.beginPath();
    ctx.arc(90, 90, 70, -Math.PI / 2, (2 * Math.PI * value) - Math.PI / 2);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 20;
    ctx.stroke();

    ctx.font = "20px Arial";
    ctx.fillStyle = warna;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(confidence + "%", 90, 90);

  } catch (error) {
    tampilkanModalError(error.message);
        resetForm(); 
  } finally {
    loading.style.display = "none";
  }
}

function resetForm() {
  document.getElementById("input-section").style.display = "block";
  document.getElementById("hasil-section").style.display = "none";
  document.getElementById("judul").value = "";
  document.getElementById("isi").value = "";
}

function exportToPDF() {
  console.log('Mengekspor ke PDF...');
  
  if (loadingText) loadingText.textContent = "Membuat file PDF...";
    if (loading) loading.style.display = 'flex';

  const element = document.getElementById('hasil-pdf');
  const tombolAnalisisGrup = document.getElementById('analisis-lagi-grup');
  const tombolExport = document.getElementById('export-pdf-button');

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const counterPart = pdfExportCounter.toString().padStart(4, '0');

  const namaFile = `Hasil Analisis DeteksiHoaks - ${year}${month}${day}${counterPart}.pdf`;

  pdfExportCounter++;

  const opt = {
    margin:       10,
    filename:     namaFile,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (tombolAnalisisGrup) tombolAnalisisGrup.style.display = 'none';
  if (tombolExport) tombolExport.style.display = 'none';

  html2pdf().from(element).set(opt).save()
    .catch(err => {
      console.error('Gagal membuat PDF:', err);
      tampilkanModalError('Gagal membuat file PDF. Silakan coba lagi.');
    })
    .finally(() => {
      if (tombolAnalisisGrup) tombolAnalisisGrup.style.display = 'flex';
      if (tombolExport) tombolExport.style.display = 'block';
      if (loading) loading.style.display = 'none';
    });
}