import { useState } from "react";
const UserAvatar = ({ name, avatar = "", className = "size-8 text-sm" }: { name: string; avatar?: string; className?: string }) => {
  const [failedUrl, setFailedUrl] = useState("");
  return <div className={`rounded-full bg-green-950 text-white flex-center font-semibold shrink-0 overflow-hidden ${className}`}>
    {avatar && avatar !== failedUrl ? <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailedUrl(avatar)} /> : name.trim().charAt(0).toUpperCase()}
  </div>;
};
export default UserAvatar;
