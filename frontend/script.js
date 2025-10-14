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

  loading.style.display = "flex";

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
    hasilSection.style.display = "block";
    hasilSection.innerHTML = `
      <div class="hasil-card">
        <h4>${judul || "(Judul Berita)"}</h4>
        ${isi ? `<p style="font-size:13px;color:#555;text-align:justify;">${isi}</p>` : ""}
        <p>Kategori :</p>
        <p class="kategori" style="color:${warna}">${kategoriText}</p>
        <canvas id="chart" width="180" height="180"></canvas>
        <p><strong>${confidence}%</strong></p>
        <div class="saran">${saranText}</div>
        <br>
        <button onclick="resetForm()" style="margin-top:15px;padding:10px 15px;border:none;border-radius:8px;background:#4a90e2;color:#fff;cursor:pointer;">Analisis Lagi</button>
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

