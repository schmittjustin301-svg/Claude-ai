import ffmpeg from "fluent-ffmpeg";

export function probeDurationSec(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data?.format?.duration) {
        resolve(null);
        return;
      }
      resolve(data.format.duration);
    });
  });
}
