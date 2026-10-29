import {startDrawingSSO} from "@/lib/drawing-sso";
export const dynamic="force-dynamic";
export async function GET(){return startDrawingSSO();}
