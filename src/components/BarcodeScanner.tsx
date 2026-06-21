"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIdx, setCameraIdx] = useState(0);

  useEffect(() => {
    let mounted = true;
    let controls: { stop: () => void } | null = null;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    const reader = new BrowserMultiFormatReader(hints);

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!mounted) return;
        setCameras(devices);
        if (devices.length === 0) {
          setError("No se detectó ninguna cámara en este dispositivo.");
          setStarting(false);
          return;
        }
        // Preferir la cámara trasera ("back" / "environment") en celulares
        const backIdx = devices.findIndex((d) =>
          /back|rear|environment|trasera/i.test(d.label || ""),
        );
        const startIdx = backIdx >= 0 ? backIdx : cameraIdx;
        setCameraIdx(startIdx);
        const targetId = devices[startIdx]?.deviceId;

        controls = await reader.decodeFromVideoDevice(
          targetId,
          videoRef.current!,
          (result, err) => {
            if (result && mounted) {
              const code = result.getText();
              if (code && /^\d{6,}$/.test(code)) {
                // Beep visual feedback could be added here
                onDetected(code);
              } else if (code) {
                onDetected(code);
              }
            }
            // ignore err continuously thrown until a code is found
          },
        );
        setStarting(false);
      } catch (e) {
        const msg = (e as Error).message || "No se pudo iniciar la cámara";
        if (/Permission|denied|NotAllowed/i.test(msg)) {
          setError("Permiso de cámara denegado. Habilítalo en la configuración del navegador.");
        } else if (/NotFound|notfound/i.test(msg)) {
          setError("No se encontró ninguna cámara.");
        } else {
          setError(msg);
        }
        setStarting(false);
      }
    })();

    return () => {
      mounted = false;
      controls?.stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraIdx]);

  function switchCamera() {
    if (cameras.length <= 1) return;
    setCameraIdx((i) => (i + 1) % cameras.length);
  }

  return (
    <div className="fixed inset-0 bg-brand-950/90 grid place-items-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 flex items-center justify-between border-b border-brand-50">
          <div>
            <h3 className="font-bold text-brand-900">Escanear código</h3>
            <div className="text-[11px] text-brand-400">Apunta la cámara al código de barras del producto.</div>
          </div>
          <button onClick={onClose} className="text-brand-300 hover:text-brand-700 text-lg">✕</button>
        </div>

        <div className="relative aspect-square bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {/* Aim overlay */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-3/4 h-1/3 border-4 border-emerald-400 rounded-2xl shadow-[0_0_0_2000px_rgba(0,0,0,0.35)]" />
          </div>
          {starting && (
            <div className="absolute inset-0 grid place-items-center text-white text-sm">
              Iniciando cámara…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center bg-brand-950/80 text-white p-6 text-center text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 flex items-center justify-between text-xs">
          <button onClick={switchCamera} disabled={cameras.length <= 1} className="btn-outline text-xs">
            Cambiar cámara
          </button>
          <button onClick={onClose} className="btn-ghost text-xs">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
