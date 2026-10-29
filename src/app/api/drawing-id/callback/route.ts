import {NextRequest} from "next/server";
import {finishDrawingSSO} from "@/lib/drawing-sso";
export const dynamic="force-dynamic";
export async function GET(request: NextRequest){return finishDrawingSSO(request);}
