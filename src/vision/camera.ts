export interface CameraOptions {
  width?: number;
  height?: number;
  facingMode?: string;
}

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async start(
    videoElement: HTMLVideoElement,
    options: CameraOptions = { width: 640, height: 480 }
  ): Promise<MediaStream> {
    this.stop();
    this.videoElement = videoElement;

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: options.width ?? 640 },
        height: { ideal: options.height ?? 480 },
        facingMode: options.facingMode ?? 'user',
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = this.stream;
      videoElement.playsInline = true;
      videoElement.muted = true;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          videoElement.removeEventListener('loadedmetadata', onLoaded);
          videoElement.play().then(() => resolve()).catch(reject);
        };
        videoElement.addEventListener('loadedmetadata', onLoaded);
      });

      return this.stream;
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera access denied. Please allow camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera found. Please connect a webcam.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Camera is currently in use by another application or blocked.');
      } else {
        throw new Error(error.message || 'Failed to start camera.');
      }
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }
}

export const cameraService = new CameraService();
