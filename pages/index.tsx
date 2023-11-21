import Image from 'next/image'
import { Inter } from 'next/font/google'
import Navbar from '@/components/Navbar'
import { open } from '@tauri-apps/api/dialog';
import { useEffect, useState } from 'react';
import { readBinaryFile, readDir, readTextFile } from '@tauri-apps/api/fs';
import { writeTextFile, BaseDirectory } from '@tauri-apps/api/fs';
import { appDir, join } from '@tauri-apps/api/path';

export default function Home() {
  const [csvFilePath, setCsvFilePath] = useState<string>('');
  const [bellSoundsPath, setBellSoundsPath] = useState<string>('');
  const [songData, setSongData] = useState<CsvRow[]>();
  const [weeklySongs, setWeeklySongs] = useState<CsvRow[]>([]);
  const [todaySong, setTodaySong] = useState<CsvRow | null>(null);
  const [settings, setSettings] = useState<Settings>();
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [songCache, setSongCache] = useState<Record<string, string>>();

  interface Settings {
    csvFilePath: string;
    bellSoundsPath: string;
    songCache: Record<string, string>;
  };

  async function saveSettings(settings: Settings) {
    try {
      // Path to the settings file in the current application directory
      const settingsFilePath = `C:\\Users\\Maytham\\Desktop\\settings.json`;

      // Write the settings to the file
      await writeTextFile(settingsFilePath, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async function loadSettings() {
    try {
      // Path to the settings file in the current application directory
      const settingsFilePath = `C:\\Users\\Maytham\\Desktop\\settings.json`;

      // Read the settings from the file
      const content = await readTextFile(settingsFilePath);
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading settings:', error);
      return null; // Return null or a default settings object if the file does not exist
    }
  }



  type CsvRow = {
    month: string,
    date: number,
    year: number,
    day: string,
    dayColor: string,
    songs: string,
    location: string,
    notes: string
  };

  function parseCsv(csvData: string): CsvRow[] {
    const rows = csvData.split('\n');
    const result = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].trim();
      if (row === '') continue;

      const columns = row.split(',').map(col => col.trim());

      const month = columns[0];
      const date = parseInt(columns[1]);
      const year = parseInt(columns[2]);
      const day = columns[3];
      const dayColor = columns[4];
      const songs = columns[5];
      const location = columns[6];
      const notes = columns[7];

      result.push({ month, date, year, day, dayColor, songs, location, notes });
    }

    return result;
  }

  const readFileContents = async (filePath: string | null) => {
    try {
      if (!filePath) throw new Error("Filepath is null");
      const content = await readTextFile(filePath);
      return content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error; // or handle the error as you see fit
    }
  };

  const openCsvFileDialog = async () => {
    try {
      const selected = await open({
        filters: [
          { name: "CSV", extensions: ['csv'] }
        ],
        multiple: false,
        directory: false,
      });
      if (Array.isArray(selected)) {
        console.error("Selected Multiple Files: ", selected);
      } else {
        if (selected)
          setCsvFilePath(selected);
        const filecontent = await readFileContents(selected);
        const parsed = parseCsv(filecontent);
        setSongData(parsed)
        console.log('Selected file: '), selected;
      }
    } catch (error) {
      console.error("Error selecting file: ", error)
    }
  }

  const openBellSoundsDir = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
      });
      if (Array.isArray(selected)) {
        console.error("Selected Multiple Folders: ", selected);
      } else {
        if (selected)
          setBellSoundsPath(selected);
        await updateSongCache();
      }
    } catch (error) {
      console.error("Error selecting folder: ", error)
    }
  }


  function isCurrentWeek(date: Date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time part to start of day
    const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)); // Monday
    const lastDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 7)); // Sunday

    return date >= firstDayOfWeek && date < lastDayOfWeek;
  }

  function setWeekData() {
    return songData?.filter(row => {
      const date = new Date(`${row.month} ${row.date}, ${row.year}`)
      return isCurrentWeek(date);
    })
  }

  function getNextWeekData() {
    return songData?.filter(row => {
      const date = new Date(`${row.month} ${row.date}, ${row.year}`);
      date.setHours(0, 0, 0, 0); // Reset time part to start of day
      const nextWeekDate = new Date();
      nextWeekDate.setDate(nextWeekDate.getDate() + (7 - nextWeekDate.getDay())); // Start of next week
      const endNextWeekDate = new Date(nextWeekDate);
      endNextWeekDate.setDate(endNextWeekDate.getDate() + 7); // End of next week

      return date >= nextWeekDate && date < endNextWeekDate;
    });
  }

  async function findWavFile(dirPath: string, targetFileName: string, visitedPaths = new Set()): Promise<string | null> {
    if (!settings) return null;
    if (songCache && songCache[targetFileName]) {
      return songCache[targetFileName];
    }
    // Avoid re-searching the same directory
    if (visitedPaths.has(dirPath)) {
      return null;
    }
    visitedPaths.add(dirPath);

    const entries = await readDir(dirPath, { recursive: false });

    // Check the current directory first
    for (const entry of entries) {
      if (!entry.children) {
        if (!entry) return null;
        if (!entry.name) return null;
        const formattedFileName = entry.name.replace(/^.*[\\\/]/, '').replace('.wav', '');
        console.log("---------------------------------------------------------------")
        console.log(entry.name, "entry")
        console.log(formattedFileName, "formatted")
        console.log(targetFileName, "target")
        console.log(formattedFileName == targetFileName);
        console.log("---------------------------------------------------------------")
        if (formattedFileName === targetFileName) {
          return entry.path;
        }
      }
    }

    // Then, search in subdirectories
    for (const entry of entries) {
      if (entry.children) {
        const found = await findWavFile(entry.path, targetFileName, visitedPaths);
        if (found) {
          settings.songCache[targetFileName] = found;
          await saveSettings(settings);
          return found;
        }
      }
    }

    return null;
  }

  async function playSound(filePath: string) {
    try {
      // Read the binary data of the wav file
      const binaryData = await readBinaryFile(filePath);

      // Create a Blob from the binary data
      const blob = new Blob([binaryData], { type: 'audio/wav' });

      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);

      // Create and play the audio from the Blob URL
      const audio = new Audio(url);
      audio.loop = true;
      audio.play().catch(error => console.error('Error playing audio:', error));
    } catch (error) {
      console.error('Error loading audio file:', error);
    }
  }
  async function updateSongCache(dirPath = bellSoundsPath, cache = {}) {
    const entries = await readDir(dirPath, { recursive: false });
    for (const entry of entries) {
      if(!entry) return;
      if(!entry.name) return;
      if (entry.children) {
        // If it's a directory, recurse into it
        await updateSongCache(entry.path, cache);
      } else if (entry.name.endsWith('.wav')) {
        // If it's a .wav file, add to cache
        const formattedFileName = entry.name.replace(/^.*[\\\/]/, '').replace('.wav', '');
        cache[formattedFileName] = entry.path;
      }
    }
    // Update state and settings after traversing the directory
    setSongCache(cache);
    await saveSettings({ ...settings, songCache: cache });
  }

  useEffect(() => {
      async function fetchSettings() {
        const set = await loadSettings();
        if (set) {
          setCsvFilePath(set.csvFilePath || '');
          setBellSoundsPath(set.bellSoundsPath || '');
          setSongCache(set.songCache || {});

          setSettings(set);

          // Load the CSV file content if the path is found in the settings
          if (set.csvFilePath) {
            try {
              const csvContent = await readFileContents(set.csvFilePath);
              const parsedData = parseCsv(csvContent);
              setSongData(parsedData);
            } catch (error) {
              console.error('Error reading CSV file:', error);
            }
          }
        }
      }

    async function loadAndPlaySound() {
      if (todaySong && todaySong.songs && !isPlaying) {
        const filePath = await findWavFile(bellSoundsPath, todaySong.songs);
        if (filePath) {
          console.log(filePath);
          setIsPlaying(true);
          playSound(filePath);
        }
      } else {
        console.log("No song for today or todaySong is not set");
      }
    }

    if (typeof window !== 'undefined') {
      loadAndPlaySound();
    }

    fetchSettings();
  }, [todaySong]);

  useEffect(() => {
    // Save settings only on the client side
    if (typeof window !== "undefined" && csvFilePath && bellSoundsPath && songCache) {
      saveSettings({ csvFilePath, bellSoundsPath, songCache });
    }
  }, [csvFilePath, bellSoundsPath, songCache]);

  useEffect(() => {
    const today = new Date();
    const isFriday = today.getDay() === 5; // Day index for Friday is 5
    let dataForWeek;

    if (isFriday) {
      dataForWeek = getNextWeekData();
    } else {
      dataForWeek = setWeekData();
    }

    setWeeklySongs(dataForWeek || []);

    const todaysSong = songData?.find(song =>
      new Date(`${song.month} ${song.date}, ${song.year}`).toDateString() === today.toDateString()
    );
    setTodaySong(todaysSong || null);

  }, [songData]);

  return (
    <div>
      <Navbar />
      <div className='container mx-auto p-4'>
        <div className="flex flex-row gap-x-10">
          <button className='btn btn-outline btn-primary mb-4' onClick={openCsvFileDialog}>Select CSV Data</button>
          <button className='btn btn-outline btn-primary mb-4' onClick={openBellSoundsDir}>Select BellSounds Folder</button>
        </div>
        {csvFilePath && <div className="text-sm text-gray-600">Selected CSV Data Path: {csvFilePath}</div>}
        {bellSoundsPath && <div className="text-sm text-gray-600">Selected BellSounds Path: {bellSoundsPath}</div>}
        {isPlaying ?
          (<svg className="animate-spin" id="disc" fill="#FFFFF" height="50px" width="50px" version="1.1" viewBox="0 0 502 502">
            <g>
              <g>
                <g>
                  <path
                    d="M428.483,73.517C381.076,26.108,318.045,0,251,0C183.956,0,120.924,26.108,73.516,73.517C26.108,120.924,0,183.955,0,251     s26.108,130.076,73.516,177.483C120.924,475.892,183.956,502,251,502c67.045,0,130.076-26.108,177.483-73.517     C475.892,381.076,502,318.045,502,251S475.892,120.924,428.483,73.517z M251,482C123.626,482,20,378.374,20,251     S123.626,20,251,20s231,103.626,231,231S378.374,482,251,482z" />
                  <path
                    d="M251,217c-18.748,0-34,15.252-34,34s15.252,34,34,34s34-15.252,34-34S269.748,217,251,217z M251,265     c-7.72,0-14-6.28-14-14c0-7.72,6.28-14,14-14c7.72,0,14,6.28,14,14C265,258.72,258.72,265,251,265z" />
                  <path
                    d="M251,162c-49.075,0-89,39.925-89,89s39.925,89,89,89s89-39.925,89-89S300.075,162,251,162z M251,320     c-38.047,0-69-30.953-69-69s30.953-69,69-69s69,30.953,69,69S289.047,320,251,320z" />
                  <path
                    d="M213.989,61.366c0.601,0,1.21-0.054,1.823-0.167C227.334,59.076,239.173,58,251,58c5.522,0,10-4.478,10-10     s-4.478-10-10-10c-13.039,0-26.097,1.188-38.811,3.53c-5.432,1-9.023,6.214-8.023,11.646     C205.053,57.995,209.258,61.366,213.989,61.366z" />
                  <path
                    d="M169.96,64.551c-2.451-4.949-8.449-6.97-13.4-4.521c-35.045,17.362-64.652,44.034-85.619,77.132     C49.391,171.181,38,210.546,38,251c0,5.522,4.477,10,10,10s10-4.478,10-10c0-73.908,41.168-140.216,107.439-173.049     C170.388,75.499,172.412,69.5,169.96,64.551z" />
                </g>
              </g>
            </g>
          </svg>) : (<h1 className="text-2xl">Finding Song...</h1>)
        }
        {todaySong && (
          <div className="bg-green-800 p-4 mb-4 rounded-lg text-white">
            <h2 className="text-lg font-bold">Playing Today:</h2>
            <p>{todaySong.songs} - {`${todaySong.month} ${todaySong.date}`}</p>
          </div>
        )}

        <h1 className="text-xl font-bold mb-4">
          Songs for {new Date().getDay() === 5 ? 'Next' : 'This'} Week
        </h1>

        <div className="flex flex-col">
          {weeklySongs.map((song, index) => (
            <div key={index} className="flex flex-col md:flex-row bg-slate-200 justify-between items-center p-4 rounded-lg mb-2">
              <div className="font-bold text-black">
                {song.day} {`${song.month.substring(0, 3)} ${song.date}`}
              </div>
              <div className="text-blue-600">{song.songs}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

