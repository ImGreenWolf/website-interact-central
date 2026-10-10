import Image from "next/image";

export default function Icon() {
    return <img src={process.env.NEXT_PUBLIC_SERVER_URL+'/favicon.png'} alt="logo" width={128} height={128}/>
}