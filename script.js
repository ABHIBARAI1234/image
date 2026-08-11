/* ==========================================================================
   AI Image Generator - Upgraded JavaScript with Retry & Queue Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element References ---
  const promptForm = document.getElementById("promptForm");
  const promptInput = document.getElementById("promptInput");
  const imageCountSelect = document.getElementById("imageCount");
  const aspectRatioSelect = document.getElementById("aspectRatio");
  const modelSelect = document.getElementById("modelSelect");
  const randomBtn = document.getElementById("randomBtn");
  const generateBtn = document.getElementById("generateBtn");
  const imageGrid = document.getElementById("imageGrid");

  // --- Creative Random Prompts ---
  const samplePrompts = [
    "A cyberpunk cityscape at midnight with neon rain and floating hologram advertisements, 8k resolution, photorealistic.",
    "A cozy medieval library inside a giant hollow oak tree, glowing lanterns, soft ambient lighting, digital painting.",
    "An astronaut playing an acoustic guitar on the surface of the moon, looking at Earth, cinematic lighting.",
    "A majestic spirit dragon made of starry cosmos nebula floating over a quiet mountain lake, fantasy artwork.",
    "A futuristic vintage car hovering above a sunset highway, synthwave aesthetic, vibrant pink and purple glow.",
    "A cute baby otter dressed as a wizard casting a spell with a glowing magic wand, highly detailed 3D render.",
    "A surreal underwater city inside a giant glass bubble, bioluminescent jellyfish swimming around, epic scale.",
    "A serene Japanese tea garden during cherry blossom season, soft sunlight filtering through red maple leaves."
  ];

  // --- Helper: Get Image Dimensions from Aspect Ratio ---
  function getDimensions(ratio) {
    switch (ratio) {
      case "16:9":
        return { width: 1280, height: 720 };
      case "9:16":
        return { width: 720, height: 1280 };
      case "4:3":
        return { width: 1024, height: 768 };
      case "1:1":
      default:
        return { width: 1024, height: 1024 };
    }
  }

  // --- Helper: Delay function for staggering requests ---
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // --- Feature 1: "Surprise Me" Prompt Generator ---
  randomBtn.addEventListener("click", () => {
    const randomIndex = Math.floor(Math.random() * samplePrompts.length);
    promptInput.value = samplePrompts[randomIndex];
    promptInput.focus();
  });

  // --- Feature 2: Form Submission & Queue Execution ---
  promptForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const promptText = promptInput.value.trim();
    if (!promptText) return;

    const count = parseInt(imageCountSelect.value, 10);
    const selectedRatio = aspectRatioSelect.value;
    const selectedModel = modelSelect.value;
    const { width, height } = getDimensions(selectedRatio);

    // Disable buttons
    setLoadingState(true);

    // Reset grid & build loading skeletons
    imageGrid.innerHTML = "";
    const loadingCards = [];

    for (let i = 0; i < count; i++) {
      const loadingCard = document.createElement("div");
      loadingCard.className = "loading-card";
      loadingCard.innerHTML = `
        <div class="spinner"></div>
        <p class="loading-text">Queueing image ${i + 1} of ${count}...</p>
      `;
      imageGrid.appendChild(loadingCard);
      loadingCards.push(loadingCard);
    }

    // Process requests sequentially/staggered to prevent server rate-limit errors
    for (let index = 0; index < count; index++) {
      const loadingCard = loadingCards[index];
      loadingCard.querySelector(".loading-text").textContent = `Generating image ${index + 1} of ${count}...`;

      // Add a small staggered pause (1 second) between multiple API calls
      if (index > 0) {
        await sleep(1000);
      }

      const seed = Math.floor(Math.random() * 10000000);
      const encodedPrompt = encodeURIComponent(promptText);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=${selectedModel}&nologo=true`;

      try {
        // Attempt image loading with automatic retry system
        const loadedImg = await fetchImageWithRetry(imageUrl, 3, 2000);
        const finalCard = createImageCard(loadedImg.src, promptText);
        imageGrid.replaceChild(finalCard, loadingCard);
      } catch (err) {
        console.error(`Image ${index + 1} failed:`, err);
        loadingCard.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #ef4444;"></i>
          <p class="loading-text" style="color: #ef4444;">Failed after retries. Try generating again.</p>
        `;
      }
    }

    setLoadingState(false);
  });

  // --- Robust Loader with Timeout & Auto-Retries ---
  function fetchImageWithRetry(url, retriesLeft = 3, delay = 2000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let timer = null;

      // Set maximum 35-second timeout per attempt
      timer = setTimeout(() => {
        img.src = ""; // Cancel load
        handleFail();
      }, 35000);

      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timer);
        handleFail();
      };

      function handleFail() {
        if (retriesLeft > 1) {
          console.warn(`Retrying image load... (${retriesLeft - 1} attempts left)`);
          // Slightly change seed parameter on retry to trigger fresh generation
          const retriedUrl = url + `&retry=${Date.now()}`;
          setTimeout(() => {
            fetchImageWithRetry(retriedUrl, retriesLeft - 1, delay)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          reject(new Error("Image generation failed after maximum retries."));
        }
      }

      img.src = url;
    });
  }

  // --- Helper: Create Rendered Image Card Component ---
  function createImageCard(imageUrl, altText) {
    const card = document.createElement("div");
    card.className = "image-card";

    card.innerHTML = `
      <img src="${imageUrl}" alt="${altText}" loading="lazy" />
      <div class="card-overlay">
        <button class="download-btn" title="Download Image">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    `;

    // Download button event listener
    const downloadBtn = card.querySelector(".download-btn");
    downloadBtn.addEventListener("click", () => downloadImage(imageUrl));

    return card;
  }

  // --- Feature 3: Image Download Handler ---
  async function downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const tempLink = document.createElement("a");
      tempLink.href = objectUrl;
      tempLink.download = `ai-image-${Date.now()}.png`;
      document.body.appendChild(tempLink);
      tempLink.click();

      document.body.removeChild(tempLink);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.warn("Direct blob download failed, falling back to new window:", error);
      // Fallback if CORS blocks direct JS blob downloading
      window.open(url, "_blank");
    }
  }

  // --- Helper: Toggle Form Control Loading States ---
  function setLoadingState(isLoading) {
    generateBtn.disabled = isLoading;
    randomBtn.disabled = isLoading;

    if (isLoading) {
      generateBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Generating...`;
    } else {
      generateBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Generate Image`;
    }
  }
});