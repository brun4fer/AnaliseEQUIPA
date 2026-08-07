import { Chrome, Download, HardDrive, ShieldCheck, Video } from "lucide-react";
import { Panel } from "@/components/ui";

export default function HelpPage() {
  return <div className="mx-auto max-w-5xl space-y-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Pilot guide</p><h1 className="mt-2 text-3xl font-bold text-white">Using Team Analysis</h1><p className="mt-2 text-sm text-slate-400">Recommended setup and important information for match-day video work.</p></div><div className="grid gap-4 md:grid-cols-2">
    <Item icon={Chrome} title="Recommended browser">Use the latest Google Chrome on Windows or macOS. Keep the browser updated for the best video and WebCodecs support.</Item>
    <Item icon={Download} title="Install on the Mac">Open the production address in Chrome, use the install icon in the address bar and choose Install. The installed app still requires an internet connection for analysis data.</Item>
    <Item icon={HardDrive} title="Large local videos">Videos are never uploaded. Files over 1 GB must be selected again after closing or fully refreshing the app. Their moments and coordinates remain saved.</Item>
    <Item icon={Video} title="Supported videos">MP4 with H.264 video and AAC audio is recommended. If a video does not open, convert it to this format before analysis.</Item>
    <Item icon={ShieldCheck} title="Data safety">Every saved moment and submoment is stored in the database immediately. Use the delete buttons carefully and contact the administrator before resetting any competition data.</Item>
    <Item icon={Download} title="Clip export">Reports exports clips locally into Moment/Submoment folders. Chrome can write directly to a chosen folder; when folder access is unavailable, the same structure is preserved in a ZIP file.</Item>
  </div></div>;
}

function Item({ icon: Icon, title, children }: { icon: typeof Chrome; title: string; children: React.ReactNode }) { return <Panel className="p-5"><Icon className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{children}</p></Panel>; }
