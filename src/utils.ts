import { access } from "fs/promises";
import { constants, createWriteStream } from "fs";
import { type as osType } from "os";

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// NTFS and FAT have many restricted characters in filenames.
// We need to remove these here because keys in this
// tree will be used to create file and folder names.
// https://en.wikipedia.org/wiki/Filename#Comparison_of_filename_limitations

// Slashes are not included here so that the names in cover.html match the ones here.
// They are removed in saveEntireManual as files are written to disk.

// Emdashes (\u2013) are included as they are multi-byte and throw off length
// calculations where 1 character is expected to be 1 byte.
const dashReplaceRegex =
  osType() === "Windows_NT" ? /[<>:"\\/|?*\0\u2013]/gm : /[\\/\0\u2013]/gm;
// Characters to remove. Mostly newlines and tabs.
const removeRegex = /[$\r\n\f\v]/gm;
export const sanitizeName = (name: string): string =>
  name.replace(dashReplaceRegex, "-").replace(removeRegex, "");

export default function saveStream(stream: any, path: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const writer = createWriteStream(path);
    stream.pipe(writer);

    writer.on("error", (err) => {
      writer.close();
      reject(err);
    });

    writer.on("close", () => {
      resolve();
    });
  });
}
