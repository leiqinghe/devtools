import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { Spin } from "antd";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";

const Timestamp = lazy(() => import("./pages/tools/Timestamp"));
const QRCodeGen = lazy(() => import("./pages/tools/QRCodeGen"));
const QRCodeDecode = lazy(() => import("./pages/tools/QRCodeDecode"));
const JsonFormat = lazy(() => import("./pages/tools/JsonFormat"));
const ColorConvert = lazy(() => import("./pages/tools/ColorConvert"));
const ImageConvert = lazy(() => import("./pages/tools/ImageConvert"));
const BaseConvert = lazy(() => import("./pages/tools/BaseConvert"));
const UrlEncode = lazy(() => import("./pages/tools/UrlEncode"));
const Base64Tool = lazy(() => import("./pages/tools/Base64Tool"));
const Md5Tool = lazy(() => import("./pages/tools/Md5Tool"));
const CaseConvert = lazy(() => import("./pages/tools/CaseConvert"));
const RmbConvert = lazy(() => import("./pages/tools/RmbConvert"));
const BarcodeGen = lazy(() => import("./pages/tools/BarcodeGen"));
const TextDiff = lazy(() => import("./pages/tools/TextDiff"));
const WordCount = lazy(() => import("./pages/tools/WordCount"));
const RegexTest = lazy(() => import("./pages/tools/RegexTest"));
const InfoExtract = lazy(() => import("./pages/tools/InfoExtract"));
const ImageCompress = lazy(() => import("./pages/tools/ImageCompress"));
const ImageToBase64 = lazy(() => import("./pages/tools/ImageToBase64"));
const IcoMaker = lazy(() => import("./pages/tools/IcoMaker"));
const ImageRounded = lazy(() => import("./pages/tools/ImageRounded"));
const ImageToSvg = lazy(() => import("./pages/tools/ImageToSvg"));
const UuidGen = lazy(() => import("./pages/tools/UuidGen"));
const PasswordGen = lazy(() => import("./pages/tools/PasswordGen"));
const MortgageCalc = lazy(() => import("./pages/tools/MortgageCalc"));
const AgeCalc = lazy(() => import("./pages/tools/AgeCalc"));
const DateCalc = lazy(() => import("./pages/tools/DateCalc"));
const UnitConvert = lazy(() => import("./pages/tools/UnitConvert"));
const IdCardParse = lazy(() => import("./pages/tools/IdCardParse"));
const FileShare = lazy(() => import("./pages/tools/FileShare"));
const ImageGen = lazy(() => import("./pages/tools/ImageGen"));
const TtsGen = lazy(() => import("./pages/tools/TtsGen"));

function LazyLoad({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/timestamp" element={<LazyLoad><Timestamp /></LazyLoad>} />
        <Route path="/qrcode-gen" element={<LazyLoad><QRCodeGen /></LazyLoad>} />
        <Route path="/qrcode-decode" element={<LazyLoad><QRCodeDecode /></LazyLoad>} />
        <Route path="/json-format" element={<LazyLoad><JsonFormat /></LazyLoad>} />
        <Route path="/color-convert" element={<LazyLoad><ColorConvert /></LazyLoad>} />
        <Route path="/image-convert" element={<LazyLoad><ImageConvert /></LazyLoad>} />
        <Route path="/base-convert" element={<LazyLoad><BaseConvert /></LazyLoad>} />
        <Route path="/url-encode" element={<LazyLoad><UrlEncode /></LazyLoad>} />
        <Route path="/base64" element={<LazyLoad><Base64Tool /></LazyLoad>} />
        <Route path="/md5" element={<LazyLoad><Md5Tool /></LazyLoad>} />
        <Route path="/case-convert" element={<LazyLoad><CaseConvert /></LazyLoad>} />
        <Route path="/rmb-convert" element={<LazyLoad><RmbConvert /></LazyLoad>} />
        <Route path="/barcode-gen" element={<LazyLoad><BarcodeGen /></LazyLoad>} />
        <Route path="/text-diff" element={<LazyLoad><TextDiff /></LazyLoad>} />
        <Route path="/word-count" element={<LazyLoad><WordCount /></LazyLoad>} />
        <Route path="/regex-test" element={<LazyLoad><RegexTest /></LazyLoad>} />
        <Route path="/info-extract" element={<LazyLoad><InfoExtract /></LazyLoad>} />
        <Route path="/image-compress" element={<LazyLoad><ImageCompress /></LazyLoad>} />
        <Route path="/image-to-base64" element={<LazyLoad><ImageToBase64 /></LazyLoad>} />
        <Route path="/ico-maker" element={<LazyLoad><IcoMaker /></LazyLoad>} />
        <Route path="/image-rounded" element={<LazyLoad><ImageRounded /></LazyLoad>} />
        <Route path="/image-to-svg" element={<LazyLoad><ImageToSvg /></LazyLoad>} />
        <Route path="/image-gen" element={<LazyLoad><ImageGen /></LazyLoad>} />
        <Route path="/uuid-gen" element={<LazyLoad><UuidGen /></LazyLoad>} />
        <Route path="/password-gen" element={<LazyLoad><PasswordGen /></LazyLoad>} />
        <Route path="/mortgage-calc" element={<LazyLoad><MortgageCalc /></LazyLoad>} />
        <Route path="/age-calc" element={<LazyLoad><AgeCalc /></LazyLoad>} />
        <Route path="/date-calc" element={<LazyLoad><DateCalc /></LazyLoad>} />
        <Route path="/unit-convert" element={<LazyLoad><UnitConvert /></LazyLoad>} />
        <Route path="/id-card-parse" element={<LazyLoad><IdCardParse /></LazyLoad>} />
        <Route path="/file-share" element={<LazyLoad><FileShare /></LazyLoad>} />
        <Route path="/tts-gen" element={<LazyLoad><TtsGen /></LazyLoad>} />
      </Route>
    </Routes>
  );
}
