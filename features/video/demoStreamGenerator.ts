/**
 * Generates a synthetic WebRTC MediaStream for preview environments,
 * automated testing, or when physical camera hardware is absent.
 * Produces real video and audio MediaStreamTracks for standard RTCPeerConnection negotiation.
 */

export function createAntiquarianDemoStream(
  displayName: string,
  city: string,
  colorTone: "amber" | "emerald" = "amber"
): MediaStream {
  if (typeof window === "undefined" || typeof document === "undefined") {
    // SSR safe dummy stream
    return {} as MediaStream;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  let frame = 0;
  const primaryColor = colorTone === "amber" ? "#f59e0b" : "#10b981";
  const bgGradColor = colorTone === "amber" ? "#1f1610" : "#0d1f17";

  function draw() {
    if (!ctx) return;
    frame++;

    // Antiquarian dark parchment gradient
    const grad = ctx.createRadialGradient(320, 240, 20, 320, 240, 340);
    grad.addColorStop(0, bgGradColor);
    grad.addColorStop(1, "#0a0908");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);

    // Subtle antique grid / compass reticle
    ctx.strokeStyle = "rgba(217, 119, 6, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(320, 240, 140, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting particle
    const angle = (frame * 0.03) % (Math.PI * 2);
    const px = 320 + Math.cos(angle) * 140;
    const py = 240 + Math.sin(angle) * 140;
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // Avatar silhouette / Monogram circle
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.arc(320, 210, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Monogram
    ctx.fillStyle = "#fef3c7";
    ctx.font = "bold 42px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayName.charAt(0).toUpperCase(), 320, 210);

    // Name & City
    ctx.font = "600 20px sans-serif";
    ctx.fillStyle = "#f3f4f6";
    ctx.fillText(displayName, 320, 290);

    ctx.font = "14px monospace";
    ctx.fillStyle = primaryColor;
    ctx.fillText(`${city} • Live Companion Feed`, 320, 315);

    // Audio wave indicator
    ctx.lineWidth = 2;
    ctx.strokeStyle = primaryColor;
    ctx.beginPath();
    for (let x = 220; x <= 420; x += 10) {
      const wave = Math.sin((x + frame * 4) * 0.05) * 8;
      if (x === 220) ctx.moveTo(x, 350 + wave);
      else ctx.lineTo(x, 350 + wave);
    }
    ctx.stroke();

    // Watermark
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(168, 162, 158, 0.6)";
    ctx.fillText("TogetherPlay WebRTC P2P Stream", 320, 440);

    requestAnimationFrame(draw);
  }

  draw();

  const stream = canvas.captureStream ? canvas.captureStream(30) : new MediaStream();

  // Create clean silent audio track via Web Audio API to satisfy RTCPeerConnection audio transceiver
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0; // Completely silent, just provides audio track
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      dest.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });
    }
  } catch (e) {
    console.warn("Could not create audio destination for demo stream:", e);
  }

  return stream;
}
