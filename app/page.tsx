"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

type ViewState = "login" | "home" | "pos_menu" | "erp_menu" | "new_customer" | "default_customer" | "satis_ekrani";
type Language = "TR" | "EN";
type ModalState = 
  | "none" 
  | "fiyat_sorgula" 
  | "urun_sorgula" 
  | "iskonto" 
  | "satis_iptal" 
  | "urun_iptal" 
  | "kampanya" 
  | "satisi_beklet" 
  | "askidan_cagir" 
  | "hediye_ceki_odeme" 
  | "destek_menu" 
  | "destek_personel" 
  | "yonetim_menu" 
  | "yonetim_sicil" 
  | "yonetim_hediye_ceki" 
  | "yonetim_hediye_ceki_onay" 
  | "odeme_ekrani";

type GecmisGorunum = "liste" | "degisim" | "cek_olustur";
type CekDurumu = "idle" | "generating" | "regenerating" | "ready" | "saving" | "success";

const translations = {
  TR: {
    posSub: "SATIŞ NOKTASI", erpSub: "SİSTEM MODÜLLERİ", mainMenu: "← ANA MENÜ",
    ncAbbr: "YM", ncFull: "YENİ MÜŞTERİ", dcAbbr: "VM", dcFull: "VARSAYILAN MÜŞTERİ",
    erpSoon: "ERP MODÜLLERİ (VARDİYA ÇİZELGESİ) YAKINDA...", phone: "TELEFON NUMARASI",
    firstName: "İSİM", lastName: "SOY İSİM", gender: "CİNSİYET", select: "Seçiniz...",
    female: "Kadın", male: "Erkek", birthYear: "DOĞUM TARİHİ (YIL)", save: "KAYDET",
    success: "KAYIT BAŞARILI", searchTitle: "TELEFON NUMARASI İLE SORGULA",
    searchPlaceholder: "Örn: 0555...", searchBtn: "SORGULA", foundTitle: "MÜŞTERİ BULUNDU",
    notFound: "BU NUMARAYA AİT KAYIT BULUNAMADI.", createNew: "YENİ KAYIT AÇ",
    lblGender: "CİNSİYET:", lblYear: "D. YILI:", lblReg: "KAYIT:", startSale: "SATIŞ EKRANINA GEÇ"
  },
  EN: {
    posSub: "POINT OF SALE", erpSub: "SYSTEM MODULES", mainMenu: "← MAIN MENU",
    ncAbbr: "NC", ncFull: "NEW CUSTOMER", dcAbbr: "DC", dcFull: "DEFAULT CUSTOMER",
    erpSoon: "ERP MODULES (SHIFT SCHEDULE) COMING SOON...", phone: "PHONE NUMBER",
    firstName: "FIRST NAME", lastName: "LAST NAME", gender: "GENDER", select: "Select...",
    female: "Female", male: "Male", birthYear: "BIRTH YEAR", save: "SAVE",
    success: "REGISTRATION SUCCESSFUL", searchTitle: "SEARCH BY PHONE NUMBER",
    searchPlaceholder: "e.g., 0555...", searchBtn: "SEARCH", foundTitle: "CUSTOMER FOUND",
    notFound: "NO RECORD FOUND FOR THIS NUMBER.", createNew: "CREATE NEW",
    lblGender: "GENDER:", lblYear: "B. YEAR:", lblReg: "REG. DATE:", startSale: "START SALE"
  }
};

const IADE_NEDENLERI = ["Müşteri Memnuniyeti", "Kalıp Farkı", "Üründe Hata", "Beden ve Renk Değişimi"];
const BANKALAR = ['Akbank', 'Denizbank', 'Finansbank', 'Garanti Bankası', 'Halkbank', 'İş Bankası', 'Vakıfbank', 'Yapı Kredi Bankası', 'Ziraat Bankası'];
const PARA_BIRIMLERI = ['Türk Lirası', 'Euro', 'Dolar'];

export default function Home() {
  const [view, setView] = useState<ViewState>("login");
  const lang: Language = "TR"; 
  const t = translations[lang]; 
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginMagaza, setLoginMagaza] = useState("");
  const [isCustomerMode, setIsCustomerMode] = useState(false);

  // GİRİŞ (LOGIN) STATELERİ
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState(false);

  // VERİTABANI DİNAMİK VERİLER
  const [personeller, setPersoneller] = useState<any[]>([]);
  const [personelTalepleri, setPersonelTalepleri] = useState<any[]>([]);
  const [sepetUrunleri, setSepetUrunleri] = useState<any[]>([]); 
  const [gecmisSiparisler, setGecmisSiparisler] = useState<any[]>([]); 

  // MÜŞTERİ STATELERİ
  const [formData, setFormData] = useState({ 
    telefon: "", 
    isim: "", 
    soyisim: "", 
    cinsiyet: "", 
    dogumYili: "" 
  });
  const [kayitBasarili, setKayitBasarili] = useState(false);
  const [kayitZatenVar, setKayitZatenVar] = useState(false); 
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  
  // SATIŞ GEÇMİŞİ VE İADE/DEĞİŞİM STATELERİ
  const [showGecmisModal, setShowGecmisModal] = useState(false); 
  const [seciliGecmisSatir, setSeciliGecmisSatir] = useState<number | null>(null);
  const [gecmisGorunum, setGecmisGorunum] = useState<GecmisGorunum>("liste");
  const [showIadeYokPopup, setShowIadeYokPopup] = useState(false);
  const [seciliDegisimUrun, setSeciliDegisimUrun] = useState<number | null>(null);
  const [iadeNedeniAcik, setIadeNedeniAcik] = useState(false);
  const [seciliNeden, setSeciliNeden] = useState("");
  
  // GEÇMİŞTEN DEĞİŞİM ÇEKİ ÜRETME STATELERİ
  const [cekSeciliUrunler, setCekSeciliUrunler] = useState<number[]>([]);
  const [cekPersonelAcik, setCekPersonelAcik] = useState(false);
  const [cekSeciliPersonel, setCekSeciliPersonel] = useState("");
  const [cekOlusturmaDurumu, setCekOlusturmaDurumu] = useState<CekDurumu>("idle");
  const [cekKodu, setCekKodu] = useState("");

  // HEDİYE ÇEKİ ÖDEME (POS KASASINDA) STATELERİ
  const [odemeCekKodu, setOdemeCekKodu] = useState("");
  const [odemeCekDurumu, setOdemeCekDurumu] = useState<"bos" | "bulundu" | "bulunamadi">("bos");
  const [odemeCekBilgi, setOdemeCekBilgi] = useState<any>(null);

  // YÖNETİM HEDİYE ÇEKİ OLUŞTURMA STATELERİ
  const [yonetimCekKodu, setYonetimCekKodu] = useState("");
  const [yonetimCekTutar, setYonetimCekTutar] = useState("");
  const [isYonetimCekValid, setIsYonetimCekValid] = useState(false);
  const [yonetimCekError, setYonetimCekError] = useState("");

  // DESTEK (PERSONEL TALEP) STATELERİ
  const [talepForm, setTalepForm] = useState({ 
    isim_soyisim: "", 
    tc_no: "", 
    dogum_tarihi: "", 
    telefon: "", 
    magaza_kodu: "LUME 1" 
  });

  // SATIŞ EKRANI VE BARKOD STATELERİ
  const [aktifSatici, setAktifSatici] = useState<string>("");
  const [aktifModal, setAktifModal] = useState<ModalState>("none");
  const [barkodInput, setBarkodInput] = useState("");

  // ==============================================================
  // YENİ: ÖDEME EKRANI (NAKİT / KREDİ KARTI) STATELERİ VE HESAPLAMALAR
  // ==============================================================
  const [odemeAktifSekme, setOdemeAktifSekme] = useState<"Nakit" | "Kredi Kartı">("Kredi Kartı");
  const [alinanOdemeler, setAlinanOdemeler] = useState<any[]>([]);
  const [odemeTuslananTutar, setOdemeTuslananTutar] = useState("");
  const [odemeSeciliBanka, setOdemeSeciliBanka] = useState(BANKALAR[0]);
  const [odemeSeciliDoviz, setOdemeSeciliDoviz] = useState(PARA_BIRIMLERI[0]);

  const sepetGenelToplam = sepetUrunleri.reduce((acc, curr) => acc + (curr.fiyat * curr.miktar), 0);
  const odenenToplam = alinanOdemeler.reduce((acc, curr) => acc + curr.tutar, 0);
  const kalanOdemeTutari = Math.max(0, sepetGenelToplam - odenenToplam);

  // Modal açıldığında veya ödeme alındığında numpad ekranına kalan tutarı otomatik yansıt
  useEffect(() => {
    if (aktifModal === "odeme_ekrani") {
      setOdemeTuslananTutar(kalanOdemeTutari.toFixed(2).replace('.', ','));
    }
  }, [kalanOdemeTutari, aktifModal]);

  const formatFiyat = (fiyat: number) => {
    return fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchPersoneller = async () => {
    const { data } = await supabase
      .from("personeller")
      .select("*")
      .order("personel_kodu", { ascending: true });
    if (data) setPersoneller(data);
  };

  const fetchTalepler = async () => {
    const { data } = await supabase
      .from("personel_talepleri")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPersonelTalepleri(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginMagaza) {
      alert("Lütfen mağaza kodu giriniz!");
      return;
    }
    const { data, error } = await supabase.from('kullanicilar').select('*').eq('kullanici_adi', loginUser).eq('sifre', loginPass).single();

    if (error || !data) {
      setLoginError(true);
    } else {
      setLoginError(false);
      fetchPersoneller();
      if (data.rol === 'admin') {
        setIsAdmin(true); setIsCustomerMode(false); setView("home");
      } else if (data.rol === 'user') {
        setIsAdmin(false); setIsCustomerMode(false); setView("home");
      } else if (data.rol === 'customer') {
        setIsAdmin(false); setIsCustomerMode(true); setAktifSatici("CUSTOMER"); setView("new_customer");
      }
    }
  };

  const handlePersonelTalepGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("personel_talepleri").insert([talepForm]);
    if (error) {
      alert("Talep gönderilirken hata oluştu!");
    } else {
      alert("Personel talebi yönetime iletildi.");
      setAktifModal("destek_menu");
      setTalepForm({ isim_soyisim: "", tc_no: "", dogum_tarihi: "", telefon: "", magaza_kodu: "LUME 1" });
    }
  };

  // ---------------------------------------------
  // BARKOD OKUTMA VE STOK (ENVANTER) DÜŞME YÖNETİMİ
  // ---------------------------------------------
  const handleBarkodOkut = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barkodInput.trim() !== "") {
      e.preventDefault();
      
      if (!aktifSatici) {
        alert("LÜTFEN ÖNCE SERVİS VEREN SATICIYI SEÇİNİZ!");
        return;
      }

      const okutulanBarkod = barkodInput.trim();
      setBarkodInput(""); 

      const { data: varyantData, error: varyantError } = await supabase
        .from('urun_varyantlari')
        .select('*, urun_kartlari(*)')
        .eq('barkod', okutulanBarkod)
        .single();

      if (varyantError || !varyantData) {
        alert("SİSTEMDE BÖYLE BİR BARKOD BULUNAMADI!");
        return;
      }

      const parentInfo = Array.isArray(varyantData.urun_kartlari) 
        ? varyantData.urun_kartlari[0] 
        : varyantData.urun_kartlari;

      if (varyantData.stok_adeti <= 0) {
        alert("ENVANTER EKSİYE DÜŞEMEZ! (Stok Yetersiz)");
        return;
      }

      // Stok düşür
      const yeniStok = varyantData.stok_adeti - 1;
      const { error: updateError } = await supabase
        .from('urun_varyantlari')
        .update({ stok_adeti: yeniStok })
        .eq('barkod', okutulanBarkod);

      if (updateError) {
        alert("STOK GÜNCELLENİRKEN HATA OLUŞTU!");
        return;
      }

      // Sepete Ekle
      const mevcutIndex = sepetUrunleri.findIndex(u => u.barkod === okutulanBarkod);
      
      if (mevcutIndex > -1) {
         const yeniSepet = [...sepetUrunleri];
         yeniSepet[mevcutIndex].miktar += 1;
         setSepetUrunleri(yeniSepet);
      } else {
         setSepetUrunleri(prev => [...prev, {
            id: varyantData.id,
            barkod: varyantData.barkod,
            urun_kodu: varyantData.urun_kodu,
            isim: parentInfo.urun_adi,
            beden: varyantData.beden,
            renk: varyantData.renk,
            fiyat: parentInfo.fiyat,
            miktar: 1
         }]);
      }
    }
  };

  // ---------------------------------------------
  // SATIŞ İPTAL EDİLDİĞİNDE DÜŞEN STOKLARI GERİ ALMA
  // ---------------------------------------------
  const handleSatisIptal = async () => {
    for (const urun of sepetUrunleri) {
      const { data } = await supabase
        .from('urun_varyantlari')
        .select('stok_adeti')
        .eq('barkod', urun.barkod)
        .single();
        
      if (data) {
        await supabase
          .from('urun_varyantlari')
          .update({ stok_adeti: data.stok_adeti + urun.miktar })
          .eq('barkod', urun.barkod);
      }
    }
    setSepetUrunleri([]);
    setAktifModal("none");
  };

  // ---------------------------------------------
  // YENİ: PARÇALI TAHSİLAT (ÖDEME) YÖNETİMİ
  // ---------------------------------------------
  const openOdemeEkrani = (sekme: "Nakit" | "Kredi Kartı") => {
    if (sepetUrunleri.length === 0) {
      alert("SEPETTE ÜRÜN BULUNMAMAKTADIR!");
      return;
    }
    setOdemeAktifSekme(sekme);
    setAktifModal("odeme_ekrani");
  };

  const handleOdemeTuslama = (deger: string) => {
    if (deger === ',' && odemeTuslananTutar.includes(',')) return;
    setOdemeTuslananTutar((prev) => (prev === '0' && deger !== ',' ? deger : prev + deger));
  };

  const handleOdemeSil = () => {
    setOdemeTuslananTutar((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleOdemeEkle = async () => {
    const tutarFloat = parseFloat(odemeTuslananTutar.replace(',', '.'));
    if (isNaN(tutarFloat) || tutarFloat <= 0) return;

    const yeniOdeme = {
      id: Date.now(),
      tip: odemeAktifSekme,
      detay: odemeAktifSekme === 'Kredi Kartı' ? odemeSeciliBanka : odemeSeciliDoviz,
      tutar: tutarFloat
    };

    const guncelOdemeler = [...alinanOdemeler, yeniOdeme];
    setAlinanOdemeler(guncelOdemeler);
    
    const yeniOdenen = guncelOdemeler.reduce((acc, curr) => acc + curr.tutar, 0);
    const yeniKalan = sepetGenelToplam - yeniOdenen;

    // Fiş tamamlandığında
    if (yeniKalan <= 0.01) { 
      const musteriBilgisi = searchResult ? `${searchResult.isim} ${searchResult.soyisim}` : (isCustomerMode ? "Müşteri Kiosk İşlemi" : "Kayıtsız Müşteri");

      for (const odeme of guncelOdemeler) {
        if (odeme.tip === "Nakit") {
          await supabase.from("nakit_odemeler").insert([{
            satici: aktifSatici,
            musteri: musteriBilgisi,
            tutar: odeme.tutar,
            para_birimi: odeme.detay
          }]);
        } else if (odeme.tip === "Kredi Kartı") {
          await supabase.from("kredi_karti_odemeler").insert([{
            satici: aktifSatici,
            musteri: musteriBilgisi,
            tutar: odeme.tutar,
            banka_adi: odeme.detay
          }]);
        }
      }

      for (const urun of sepetUrunleri) {
        await supabase.from("satislar").insert([{
          telefon: searchResult ? searchResult.telefon : "Kayıtsız",
          isim: searchResult ? searchResult.isim : "Kayıtsız",
          soyisim: searchResult ? searchResult.soyisim : "Müşteri",
          urun_kodu: urun.urun_kodu || urun.barkod,
          urun_adi: urun.isim,
          tutar: urun.fiyat
        }]);
      }

      setTimeout(() => {
        alert("SATIŞ BAŞARIYLA ONAYLANDI VE TAHSİLAT TAMAMLANDI!");
        setSepetUrunleri([]);
        setAlinanOdemeler([]);
        setAktifModal("none");
        if (!isCustomerMode) setAktifSatici(""); 
        setSearchPhone("");
        setSearchResult(null);
        setSearchStatus("idle");
        setView(isCustomerMode ? "new_customer" : "home"); 
      }, 800);
    } else {
      setOdemeTuslananTutar(yeniKalan.toFixed(2).replace('.', ','));
    }
  };

  const handleOdemeModalKapat = () => {
    // Alınan ödemeler silinmez, kasiyer sepete geri dönebilir
    setAktifModal("none");
  };

  // ---------------------------------------------
  // YÖNETİM MODÜLÜ ÇEK OLUŞTURMA VE KONTROL
  // ---------------------------------------------
  const uretCekKodu = () => {
    const chars = "0123456UMT"; 
    let code = "";
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const handleYonetimCekUret = async () => {
    setYonetimCekError("");
    setIsYonetimCekValid(false);
    const newCode = uretCekKodu();
    setYonetimCekKodu(newCode);

    const { data } = await supabase
      .from("uretilen_cek")
      .select("cek_numarasi")
      .eq("cek_numarasi", newCode);

    if (data && data.length > 0) {
      setYonetimCekError("BU KOD ZATEN MEVCUT! LÜTFEN TEKRAR OLUŞTURUN.");
    } else {
      setIsYonetimCekValid(true);
    }
  };

  const handleYonetimCekKaydet = async () => {
    const { error } = await supabase.from("uretilen_cek").insert([{
      cek_numarasi: yonetimCekKodu,
      cek_fiyat_tutari: parseFloat(yonetimCekTutar)
    }]);
    
    if (error) {
      alert("Hata: " + error.message);
    } else {
      alert("Hediye çeki başarıyla oluşturuldu ve veritabanına kaydedildi!");
      setAktifModal("yonetim_menu");
      setYonetimCekKodu("");
      setYonetimCekTutar("");
      setIsYonetimCekValid(false);
      setYonetimCekError("");
    }
  };

  async function checkPhoneExists(phone: string) {
    if (!phone) return;
    const { data } = await supabase.from("cariler").select("*").eq("telefon", phone);
    if (data && data.length > 0) {
      setKayitZatenVar(true);
      setTimeout(() => {
        setKayitZatenVar(false); 
        setFormData({ telefon: "", isim: "", soyisim: "", cinsiyet: "", dogumYili: "" }); 
        setSearchPhone(phone); 
        setSearchResult(data[0]); 
        setSearchStatus("found"); 
        setView("default_customer");
      }, 2000);
    }
  }

  async function cariEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.isim || !formData.soyisim || !formData.telefon) return; 
    
    const { error } = await supabase.from("cariler").insert([{ 
      unvan: `${formData.isim} ${formData.soyisim}`, 
      telefon: formData.telefon, 
      isim: formData.isim, 
      soyisim: formData.soyisim, 
      cinsiyet: formData.cinsiyet, 
      dogum_yili: formData.dogumYili 
    }]);

    if (error) {
      alert("SUPABASE HATASI: " + error.message);
    } else {
      setKayitBasarili(true); 
      setFormData({ telefon: "", isim: "", soyisim: "", cinsiyet: "", dogumYili: "" }); 
      setTimeout(() => { 
        setKayitBasarili(false); 
        setView("satis_ekrani"); 
      }, 2000);
    }
  }

  async function cariAra(e: React.FormEvent) {
    e.preventDefault();
    if (!searchPhone) return;
    setSearchStatus("loading");
    const { data } = await supabase.from("cariler").select("*").eq("telefon", searchPhone);
    if (data && data.length > 0) { 
      setSearchResult(data[0]); 
      setSearchStatus("found"); 
    } else { 
      setSearchResult(null); 
      setSearchStatus("not_found"); 
    }
  }

  const changeView = (newView: ViewState) => {
    setView(newView); 
    if (newView !== "satis_ekrani") {
      setSearchPhone(""); 
      setSearchStatus("idle"); 
      setSearchResult(null);
    }
  };

  const handleMenuClick = (menuId: number) => {
    if (menuId === 1) setAktifSatici(""); 
    if (menuId === 2) setAktifModal("fiyat_sorgula");
    if (menuId === 3) setAktifModal("urun_sorgula");
    if (menuId === 4) setAktifModal("iskonto");
    if (menuId === 5) setAktifModal("satis_iptal");
    if (menuId === 6) setAktifModal("urun_iptal");
    if (menuId === 9) setAktifModal("satisi_beklet"); 
    if (menuId === 10) setAktifModal("askidan_cagir"); 
    if (menuId === 8) setAktifModal("kampanya");
  };

  const gecmisModalKapat = () => {
    setShowGecmisModal(false); 
    setSeciliGecmisSatir(null); 
    setGecmisGorunum("liste");
    setShowIadeYokPopup(false); 
    setSeciliDegisimUrun(null); 
    setSeciliNeden("");
    setCekSeciliUrunler([]); 
    setCekSeciliPersonel(""); 
    setCekOlusturmaDurumu("idle");
  };

  const toggleGecmisSatir = (id: number) => setSeciliGecmisSatir(seciliGecmisSatir === id ? null : id);
  const toggleCekUrun = (id: number) => setCekSeciliUrunler(cekSeciliUrunler.includes(id) ? cekSeciliUrunler.filter(u => u !== id) : [...cekSeciliUrunler, id]);

  const handleCekOlusturSistemi = async () => {
    setCekOlusturmaDurumu("generating"); 
    await new Promise(r => setTimeout(r, 800));
    
    let isUnique = false; 
    let newCode = "";
    
    while (!isUnique) {
      newCode = uretCekKodu();
      const { data } = await supabase.from("uretilen_cek").select("cek_numarasi").eq("cek_numarasi", newCode);
      if (data && data.length > 0) { 
        setCekOlusturmaDurumu("regenerating"); 
        await new Promise(r => setTimeout(r, 1200)); 
      } else {
        isUnique = true;
      }
    }
    setCekKodu(newCode); 
    setCekOlusturmaDurumu("ready");
  };

  const handleCekVeritabaniKaydet = async () => {
    setCekOlusturmaDurumu("saving");
    
    const secilenUrunlerToplam = gecmisSiparisler
      .filter(u => cekSeciliUrunler.includes(u.id))
      .reduce((t, u) => t + u.fiyat, 0);

    const { error } = await supabase.from("uretilen_cek").insert([{ 
      cek_numarasi: cekKodu, 
      cek_fiyat_tutari: secilenUrunlerToplam 
    }]);

    if (error) {
      if (error.code === "23505") { 
        setCekOlusturmaDurumu("regenerating"); 
        handleCekOlusturSistemi(); 
      } else { 
        alert("Hata: " + error.message); 
        setCekOlusturmaDurumu("ready"); 
      }
    } else {
      setCekOlusturmaDurumu("success"); 
      setTimeout(() => gecmisModalKapat(), 2500);
    }
  };

  const handleCekSorgula = async () => {
    if (!odemeCekKodu) return;
    const { data } = await supabase
      .from("uretilen_cek")
      .select("*")
      .eq("cek_numarasi", odemeCekKodu.trim().toUpperCase());

    if (data && data.length > 0) { 
      setOdemeCekBilgi(data[0]); 
      setOdemeCekDurumu("bulundu"); 
    } else { 
      setOdemeCekBilgi(null); 
      setOdemeCekDurumu("bulunamadi"); 
    }
  };

  // ==========================================
  // RENDER ALANI
  // ==========================================

  if (view === "login") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 via-black to-blue-900/20 opacity-50"></div>
        <form onSubmit={handleLogin} className="bg-zinc-900 border border-gray-800 p-12 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.05)] w-full max-w-md flex flex-col gap-6 animate-fade-in relative z-10">
          <div className="text-white text-5xl font-thin tracking-widest text-center mb-4">L'UME</div>
          
          {loginError && (
            <div className="bg-red-900/30 text-red-400 border border-red-500/50 p-3 rounded-lg text-xs font-bold text-center tracking-widest uppercase">
              Kullanıcı Adı Veya Şifre Hatalı!
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <label className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">Mağaza Kodu</label>
            <input type="text" value={loginMagaza} onChange={e => setLoginMagaza(e.target.value)} className="bg-black/50 border border-gray-700 focus:border-white rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors mb-2" placeholder="Örn: LUME-01" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">Kullanıcı Adı</label>
            <input 
              type="text" 
              value={loginUser} 
              onChange={e => setLoginUser(e.target.value)} 
              className="bg-black/50 border border-gray-700 focus:border-white rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors" 
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">Şifre</label>
            <input 
              type="password" 
              value={loginPass} 
              onChange={e => setLoginPass(e.target.value)} 
              className="bg-black/50 border border-gray-700 focus:border-white rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors" 
            />
          </div>
          
          <button type="submit" className="mt-4 py-5 bg-white text-black hover:bg-gray-200 rounded-xl font-black tracking-[0.2em] uppercase text-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            SİSTEME GİRİŞ YAP
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-black from-40% via-zinc-800 to-zinc-400 relative flex items-center justify-start overflow-hidden font-sans">
      
      <div className="absolute bottom-12 right-16 text-4xl font-light text-[#222] tracking-widest mix-blend-color-burn z-0 pointer-events-none">
        uV.1
      </div>

      {/* SADECE ANA MENÜDE GÖRÜNEN DESTEK VE YÖNETİM BUTONLARI */}
      {view === "home" && (
        <div className="absolute top-12 right-16 flex items-center gap-6 z-20">
          <button onClick={() => setAktifModal("destek_menu")} className="px-6 py-3 border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-[10px] font-bold tracking-[0.2em] rounded-xl transition-all uppercase shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            DESTEK
          </button>
          
          {isAdmin && (
            <button onClick={() => setAktifModal("yonetim_menu")} className="px-6 py-3 border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[10px] font-bold tracking-[0.2em] rounded-xl transition-all uppercase shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              YÖNETİM
            </button>
          )}
        </div>
      )}

      {view === "home" && (
        <div className="flex gap-8 pl-16 md:pl-32 transition-all duration-500 animate-fade-in z-10">
          <div onClick={() => changeView("pos_menu")} className="flex flex-col items-center gap-4 cursor-pointer group">
            <div className="text-white text-6xl font-thin tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,1)] transition-all">
              POS
            </div>
            <div className="px-6 py-3 border border-white/80 rounded-2xl text-white text-[10px] font-bold tracking-[0.2em] shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] group-hover:bg-white/5 transition-all uppercase">
              {t.posSub}
            </div>
          </div>
          <div onClick={() => changeView("erp_menu")} className="flex flex-col items-center gap-4 cursor-pointer group">
            <div className="text-white text-6xl font-thin tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,1)] transition-all">
              ERP
            </div>
            <div className="px-6 py-3 border border-white/80 rounded-2xl text-white text-[10px] font-bold tracking-[0.2em] shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] group-hover:bg-white/5 transition-all uppercase">
              {t.erpSub}
            </div>
          </div>
        </div>
      )}

      {view === "pos_menu" && (
        <div className="flex flex-col gap-12 pl-16 md:pl-32 transition-all duration-500 animate-fade-in z-10">
          <button onClick={() => changeView("home")} className="text-white/50 hover:text-white transition-colors tracking-[0.2em] text-xs font-semibold self-start uppercase">
            {t.mainMenu}
          </button>
          
          <div className="flex gap-8">
            <div onClick={() => changeView("new_customer")} className="flex flex-col items-center gap-4 cursor-pointer group">
              <div className="text-white text-6xl font-thin tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,1)] transition-all">
                {t.ncAbbr}
              </div>
              <div className="px-6 py-3 border border-white/80 rounded-2xl text-white text-[10px] font-bold tracking-[0.2em] shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] group-hover:bg-white/5 transition-all uppercase">
                {t.ncFull}
              </div>
            </div>
            <div onClick={() => changeView("default_customer")} className="flex flex-col items-center gap-4 cursor-pointer group">
              <div className="text-white text-6xl font-thin tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,1)] transition-all">
                {t.dcAbbr}
              </div>
              <div className="px-6 py-3 border border-white/80 rounded-2xl text-white text-[10px] font-bold tracking-[0.2em] shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] group-hover:bg-white/5 transition-all uppercase">
                {t.dcFull}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "erp_menu" && (
        <div className="flex flex-col gap-12 pl-16 md:pl-32 transition-all duration-500 animate-fade-in z-10">
          <button onClick={() => changeView("home")} className="text-white/50 hover:text-white transition-colors tracking-[0.2em] text-xs font-semibold self-start uppercase">
            {t.mainMenu}
          </button>
          <div className="text-white/40 tracking-widest font-light text-xl border border-white/10 p-8 rounded-2xl bg-white/5 backdrop-blur-sm uppercase">
            {t.erpSoon}
          </div>
        </div>
      )}

      {view === "new_customer" && (
        <div className="flex gap-16 pl-16 md:pl-32 items-center w-full max-w-5xl transition-all duration-700 animate-fade-in z-10">
          <div onClick={() => !isCustomerMode && changeView("pos_menu")} className={`flex flex-col items-center gap-4 shrink-0 ${!isCustomerMode ? 'cursor-pointer group' : ''}`}>
            <div className="text-white text-6xl font-thin tracking-widest drop-shadow-[0_0_25px_rgba(255,255,255,1)]">{t.ncAbbr}</div>
            <div className="px-6 py-3 border border-white rounded-2xl text-white text-[10px] font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.6)] bg-white/5 uppercase">{t.ncFull}</div>
          </div>

          <form onSubmit={cariEkle} className="flex-1 bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-[0_0_30px_rgba(255,255,255,0.05)] relative">
            
            {kayitBasarili && (
               <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-xl font-light tracking-widest border border-green-500/50 z-20 uppercase">
                 {t.success}
               </div>
            )}

            {kayitZatenVar && (
               <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-white border border-blue-500/50 z-20 uppercase">
                 <span className="text-xl font-bold tracking-widest mb-2">MÜŞTERİ KAYDI BULUNDU</span>
                 <span className="text-sm font-light tracking-widest">MÜŞTERİ BİLGİLERİNE YÖNLENDİRİLİYOR...</span>
               </div>
            )}
            
            <div className="flex items-center justify-between py-5 border-b border-white/10">
              <div className="flex items-center gap-4 text-white text-[10px] tracking-[0.2em] font-light uppercase">{t.phone}</div>
              <input 
                type="text" 
                required 
                value={formData.telefon} 
                onChange={(e) => setFormData({...formData, telefon: e.target.value})} 
                onBlur={(e) => checkPhoneExists(e.target.value)}
                className="bg-transparent border border-white/30 rounded-lg px-4 py-2 w-64 text-white text-sm focus:outline-none focus:border-white transition-colors" 
              />
            </div>
            
            <div className="flex items-center justify-between py-5 border-b border-white/10">
              <div className="flex items-center gap-4 text-white text-[10px] tracking-[0.2em] font-light uppercase">{t.firstName}</div>
              <input type="text" required value={formData.isim} onChange={(e) => setFormData({...formData, isim: e.target.value})} className="bg-transparent border border-white/30 rounded-lg px-4 py-2 w-64 text-white text-sm focus:outline-none focus:border-white transition-colors" />
            </div>
            
            <div className="flex items-center justify-between py-5 border-b border-white/10">
              <div className="flex items-center gap-4 text-white text-[10px] tracking-[0.2em] font-light uppercase">{t.lastName}</div>
              <input type="text" required value={formData.soyisim} onChange={(e) => setFormData({...formData, soyisim: e.target.value})} className="bg-transparent border border-white/30 rounded-lg px-4 py-2 w-64 text-white text-sm focus:outline-none focus:border-white transition-colors" />
            </div>
            
            <div className="flex items-center justify-between py-5 border-b border-white/10">
              <div className="flex items-center gap-4 text-white text-[10px] tracking-[0.2em] font-light uppercase">{t.gender}</div>
              <select value={formData.cinsiyet} onChange={(e) => setFormData({...formData, cinsiyet: e.target.value})} className="bg-transparent border border-white/30 rounded-lg px-4 py-2 w-64 text-white text-sm focus:outline-none focus:border-white transition-colors appearance-none cursor-pointer">
                <option value="" className="text-black">{t.select}</option>
                <option value="Kadin" className="text-black">{t.female}</option>
                <option value="Erkek" className="text-black">{t.male}</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between py-5 border-b border-white/10">
              <div className="flex items-center gap-4 text-white text-[10px] tracking-[0.2em] font-light uppercase">{t.birthYear}</div>
              <input type="text" value={formData.dogumYili} onChange={(e) => setFormData({...formData, dogumYili: e.target.value})} className="bg-transparent border border-white/30 rounded-lg px-4 py-2 w-64 text-white text-sm focus:outline-none focus:border-white transition-colors" />
            </div>
            
            <div className="w-full flex justify-end mt-4">
               <button type="submit" className="px-6 py-2 border border-white/50 hover:border-white rounded-lg text-white text-[10px] font-bold tracking-[0.2em] transition-all uppercase">
                 {t.save}
               </button>
            </div>
          </form>
        </div>
      )}

      {view === "default_customer" && (
        <div className="flex gap-16 pl-16 md:pl-32 items-center w-full max-w-6xl transition-all duration-700 animate-fade-in z-10">
          
          <div onClick={() => changeView("pos_menu")} className="flex flex-col items-center gap-4 cursor-pointer shrink-0 group">
            <div className="text-white text-6xl font-thin tracking-widest drop-shadow-[0_0_25px_rgba(255,255,255,1)]">{t.dcAbbr}</div>
            <div className="px-6 py-3 border border-white rounded-2xl text-white text-[10px] font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.6)] bg-white/5 uppercase">{t.dcFull}</div>
          </div>

          <div className="flex-1">
            <form onSubmit={cariAra} className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-[0_0_30px_rgba(255,255,255,0.05)] mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-white text-[10px] tracking-[0.2em] font-light uppercase">{t.searchTitle}</div>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    placeholder={t.searchPlaceholder}
                    value={searchPhone} 
                    onChange={(e) => setSearchPhone(e.target.value)} 
                    className="bg-transparent border border-white/30 rounded-lg px-4 py-2 w-64 text-white text-sm focus:outline-none focus:border-white transition-colors placeholder-white/30" 
                    autoFocus
                  />
                  <button type="submit" className="px-6 py-2 bg-white/10 border border-white/50 hover:border-white rounded-lg text-white text-[10px] font-bold tracking-[0.2em] transition-all uppercase">
                    {t.searchBtn}
                  </button>
                </div>
              </div>
            </form>

            {searchStatus === "found" && searchResult && (
              <div className="bg-white/10 backdrop-blur-md border border-green-500/30 rounded-2xl p-8 shadow-[0_0_20px_rgba(74,222,128,0.1)] flex flex-col gap-4">
                 <div className="text-green-400 text-xs tracking-widest font-bold mb-2 uppercase">{t.foundTitle}</div>
                 <div className="text-white text-2xl font-light tracking-wide">{searchResult.isim} {searchResult.soyisim}</div>
                 <div className="flex gap-8 text-white/60 text-sm font-light mt-2">
                   <div>{t.lblGender} <span className="text-white">{searchResult.cinsiyet === 'Kadin' ? t.female : (searchResult.cinsiyet === 'Erkek' ? t.male : "-")}</span></div>
                   <div>{t.lblYear} <span className="text-white">{searchResult.dogum_yili || "-"}</span></div>
                   <div>{t.lblReg} <span className="text-white">{new Date(searchResult.created_at).toLocaleDateString("tr-TR")}</span></div>
                 </div>
                 
                 <div className="flex gap-4 mt-4">
                   <button onClick={() => setShowGecmisModal(true)} className="flex-1 py-3 bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/40 rounded-xl text-white text-xs font-bold tracking-[0.2em] transition-all uppercase">
                     SATIN ALMA GEÇMİŞİ
                   </button>
                   <button onClick={() => changeView("satis_ekrani")} className="flex-1 py-3 bg-green-500/20 border border-green-500/50 hover:bg-green-500/40 rounded-xl text-white text-xs font-bold tracking-[0.2em] transition-all uppercase">
                     {t.startSale}
                   </button>
                 </div>
              </div>
            )}

            {searchStatus === "not_found" && (
              <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 flex items-center justify-between">
                 <div className="text-red-400 text-sm tracking-widest font-light uppercase">{t.notFound}</div>
                 <button onClick={() => changeView("new_customer")} className="px-6 py-2 bg-red-500/20 border border-red-500/50 hover:border-red-400 rounded-lg text-white text-[10px] font-bold tracking-[0.2em] transition-all uppercase">
                   {t.createNew} ({t.ncAbbr})
                 </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- YENİ DESTEK MENÜSÜ --- */}
      {aktifModal === "destek_menu" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="bg-zinc-900 border border-blue-500/50 p-10 rounded-3xl shadow-[0_0_60px_rgba(59,130,246,0.25)] w-full max-w-4xl flex flex-col gap-8">
             <div className="flex justify-between items-center border-b border-blue-900/50 pb-4 shrink-0">
               <h2 className="text-blue-400 text-2xl tracking-widest font-bold uppercase">DESTEK MENÜSÜ</h2>
               <button onClick={() => setAktifModal("none")} className="px-6 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl border border-red-500/50 transition-all text-xs font-bold tracking-widest uppercase">
                 KAPAT
               </button>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <button onClick={() => setAktifModal("destek_personel")} className="flex flex-col items-center justify-center p-8 border border-blue-500/30 rounded-2xl hover:bg-blue-600/20 hover:border-blue-400 transition-all group shadow-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <svg className="w-12 h-12 text-blue-400 mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  <span className="text-white text-xs font-bold tracking-widest uppercase text-center">PERSONEL TANIMLA</span>
               </button>
             </div>
          </div>
        </div>
      )}

      {/* DESTEK FORMU (Personel Tanımla) */}
      {aktifModal === "destek_personel" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <form onSubmit={handlePersonelTalepGonder} className="bg-zinc-900 border border-blue-500/50 p-8 rounded-3xl shadow-[0_0_60px_rgba(59,130,246,0.25)] w-full max-w-xl flex flex-col gap-6">
             <h2 className="text-blue-400 text-lg tracking-widest font-bold border-b border-blue-900/50 pb-4 uppercase">
               PERSONEL TANIMLA
             </h2>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-2">
                 <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">İSİM SOYİSİM</label>
                 <input type="text" required value={talepForm.isim_soyisim} onChange={e => setTalepForm({...talepForm, isim_soyisim: e.target.value})} className="bg-black/50 border border-gray-600 focus:border-blue-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors uppercase" />
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">TC KİMLİK NO</label>
                 <input type="text" required value={talepForm.tc_no} onChange={e => setTalepForm({...talepForm, tc_no: e.target.value})} className="bg-black/50 border border-gray-600 focus:border-blue-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors uppercase" />
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">DOĞUM TARİHİ</label>
                 <input type="date" required value={talepForm.dogum_tarihi} onChange={e => setTalepForm({...talepForm, dogum_tarihi: e.target.value})} className="bg-black/50 border border-gray-600 focus:border-blue-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors uppercase" />
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">TELEFON NU</label>
                 <input type="text" required value={talepForm.telefon} onChange={e => setTalepForm({...talepForm, telefon: e.target.value})} className="bg-black/50 border border-gray-600 focus:border-blue-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors uppercase" />
               </div>
             </div>
             
             <div className="flex flex-col gap-2 mt-2">
               <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">MAĞAZA KODU</label>
               <input type="text" required value={talepForm.magaza_kodu} onChange={e => setTalepForm({...talepForm, magaza_kodu: e.target.value})} className="bg-black/50 border border-gray-600 focus:border-blue-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors uppercase" />
             </div>

             <div className="flex gap-4 mt-4">
                <button type="button" onClick={() => setAktifModal("destek_menu")} className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white font-bold tracking-widest text-xs uppercase transition-all">
                  İPTAL (GERİ DÖN)
                </button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold tracking-widest text-xs uppercase transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                  TALEBİ GÖNDER
                </button>
             </div>
          </form>
        </div>
      )}

      {/* --- YÖNETİM MENÜSÜ --- */}
      {aktifModal === "yonetim_menu" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="bg-zinc-900 border border-red-500/50 p-10 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.25)] w-full max-w-4xl flex flex-col gap-8">
             <div className="flex justify-between items-center border-b border-red-900/50 pb-4 shrink-0">
               <h2 className="text-red-400 text-2xl tracking-widest font-bold uppercase">YÖNETİM MENÜSÜ</h2>
               <button onClick={() => setAktifModal("none")} className="px-6 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl border border-red-500/50 transition-all text-xs font-bold tracking-widest uppercase">
                 KAPAT
               </button>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <button onClick={() => { setAktifModal("yonetim_sicil"); fetchTalepler(); }} className="flex flex-col items-center justify-center p-8 border border-red-500/30 rounded-2xl hover:bg-red-600/20 hover:border-red-400 transition-all group shadow-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <svg className="w-12 h-12 text-red-400 mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="text-white text-xs font-bold tracking-widest uppercase text-center">PERSONEL SİCİL KABUL</span>
               </button>
               <button onClick={() => setAktifModal("yonetim_hediye_ceki")} className="flex flex-col items-center justify-center p-8 border border-red-500/30 rounded-2xl hover:bg-red-600/20 hover:border-red-400 transition-all group shadow-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <svg className="w-12 h-12 text-red-400 mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                  <span className="text-white text-xs font-bold tracking-widest uppercase text-center">HEDİYE ÇEKİ OLUŞTUR</span>
               </button>
             </div>
          </div>
        </div>
      )}

      {/* YÖNETİM HEDİYE ÇEKİ OLUŞTURMA */}
      {aktifModal === "yonetim_hediye_ceki" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          <div className="bg-zinc-900 border border-red-500/50 p-8 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.25)] w-full max-w-lg flex flex-col gap-6">
            <h2 className="text-red-400 text-lg tracking-widest font-bold border-b border-red-900/50 pb-4 uppercase">
              HEDİYE ÇEKİ OLUŞTUR (YÖNETİM)
            </h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">ÇEK NUMARASI</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  readOnly 
                  value={yonetimCekKodu} 
                  placeholder="KOD OLUŞTURULMADI" 
                  className="flex-1 bg-black/50 border border-gray-600 rounded-xl p-4 text-white outline-none tracking-widest text-sm uppercase cursor-not-allowed" 
                />
                <button 
                  type="button" 
                  onClick={handleYonetimCekUret} 
                  className="px-6 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold tracking-widest text-xs uppercase transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                >
                  OLUŞTUR
                </button>
              </div>
              {yonetimCekError && <span className="text-red-400 text-[10px] font-bold tracking-widest uppercase mt-1">{yonetimCekError}</span>}
              {isYonetimCekValid && <span className="text-green-400 text-[10px] font-bold tracking-widest uppercase mt-1">KOD KULLANIMA UYGUN</span>}
            </div>

            {isYonetimCekValid && (
              <div className="flex flex-col gap-4 animate-fade-in-up">
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">KULLANICI (ADMİN)</label>
                  <input type="text" readOnly value="ADMINLUME" className="w-full bg-black/80 border border-gray-800 rounded-xl p-4 text-gray-500 outline-none tracking-widest text-sm font-bold uppercase cursor-not-allowed" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">ÇEK TUTARI (TL)</label>
                  <input type="number" value={yonetimCekTutar} onChange={e => setYonetimCekTutar(e.target.value)} placeholder="Örn: 500" className="w-full bg-black/50 border border-gray-600 focus:border-red-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm transition-colors" />
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-4">
              <button 
                onClick={() => { setAktifModal("yonetim_menu"); setYonetimCekKodu(""); setYonetimCekTutar(""); setIsYonetimCekValid(false); setYonetimCekError(""); }} 
                className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white font-bold tracking-widest text-xs uppercase transition-all"
              >
                İPTAL (GERİ DÖN)
              </button>
              <button 
                disabled={!isYonetimCekValid || !yonetimCekTutar} 
                onClick={() => setAktifModal("yonetim_hediye_ceki_onay")} 
                className={`flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase transition-all ${isYonetimCekValid && yonetimCekTutar ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'}`}
              >
                ONAYLA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YÖNETİM HEDİYE ÇEKİ SON ONAY */}
      {aktifModal === "yonetim_hediye_ceki_onay" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          <div className="bg-zinc-900 border border-red-500/50 p-8 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.25)] w-full max-w-md flex flex-col gap-6 text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="text-white text-xl tracking-widest font-bold uppercase">SON ONAY</h2>
            <p className="text-gray-400 text-sm tracking-widest leading-relaxed">
              <strong className="text-white">{yonetimCekKodu}</strong> KODLU VE <strong className="text-green-400">{yonetimCekTutar} TL</strong> TUTARINDAKİ HEDİYE ÇEKİNİ OLUŞTURMAK İSTEDİĞİNİZE EMİN MİSİNİZ?
            </p>
            <div className="flex gap-4 mt-4">
              <button 
                onClick={() => setAktifModal("yonetim_hediye_ceki")} 
                className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white font-bold tracking-widest text-xs uppercase transition-all"
              >
                VAZGEÇ
              </button>
              <button 
                onClick={handleYonetimCekKaydet} 
                className="flex-1 py-4 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold tracking-widest text-xs uppercase transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                ONAYLA VE OLUŞTUR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YÖNETİM SİCİL KABUL EKRANI */}
      {aktifModal === "yonetim_sicil" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          <div className="bg-[#e6e5df] p-8 rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col shadow-[0_0_80px_rgba(0,0,0,1)] relative overflow-hidden">
             
             <div className="flex justify-between items-center mb-6 border-b-2 border-gray-400 pb-4 shrink-0">
               <h2 className="text-gray-900 text-2xl tracking-widest font-black uppercase">
                 PERSONEL SİCİL KABUL EKRANI
               </h2>
               <button onClick={() => setAktifModal("yonetim_menu")} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-lg">
                 KAPAT (GERİ DÖN)
               </button>
             </div>

             <div className="flex-1 overflow-auto border border-gray-400 bg-white rounded-xl shadow-inner">
               <table className="w-full text-left border-collapse whitespace-nowrap">
                 <thead>
                   <tr className="bg-gray-200 text-gray-700 text-xs tracking-widest font-extrabold uppercase border-b border-gray-400">
                     <th className="py-4 px-6 border-r border-gray-300">İSİM SOYİSİM</th>
                     <th className="py-4 px-6 border-r border-gray-300">TC KİMLİK NO</th>
                     <th className="py-4 px-6 border-r border-gray-300">DOĞUM TARİHİ</th>
                     <th className="py-4 px-6 border-r border-gray-300">TELEFON NU</th>
                     <th className="py-4 px-6 border-r border-gray-300 text-center">MAĞAZA KODU</th>
                     <th className="py-4 px-6 text-center">İŞLEM (ONAY DURUMU)</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm font-medium text-gray-800">
                   {personelTalepleri.length > 0 ? (
                     personelTalepleri.map((talep, idx) => (
                       <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                         <td className="py-4 px-6 border-r border-gray-200">{talep.isim_soyisim}</td>
                         <td className="py-4 px-6 border-r border-gray-200">{talep.tc_no}</td>
                         <td className="py-4 px-6 border-r border-gray-200">{talep.dogum_tarihi}</td>
                         <td className="py-4 px-6 border-r border-gray-200">{talep.telefon}</td>
                         <td className="py-4 px-6 border-r border-gray-200 text-center font-bold text-gray-500">{talep.magaza_kodu}</td>
                         <td className="py-4 px-6 text-center">
                           <span className="px-4 py-2 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                             BEKLEMEDE
                           </span>
                         </td>
                       </tr>
                     ))
                   ) : (
                     <tr>
                       <td colSpan={6} className="py-12 text-center text-gray-400 font-bold tracking-widest uppercase">
                         GÖSTERİLECEK PERSONEL TALEBİ BULUNAMADI.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
             
          </div>
        </div>
      )}

      {/* --- YENİ EKRU TASARIM: PARÇALI ÖDEME MODALI (NAKİT / KREDİ KARTI) --- */}
      {aktifModal === "odeme_ekrani" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4" style={{ zIndex: 9999 }}>
          
          <div className="bg-[#EFEAE2] w-[700px] rounded-[2rem] p-8 shadow-2xl relative flex flex-col font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black tracking-widest uppercase text-gray-800">TAHSİLAT EKRANI</h2>
              <button onClick={handleOdemeModalKapat} className="bg-red-600 text-white w-8 h-8 rounded-full font-bold flex items-center justify-center text-lg shadow-md hover:bg-red-700 transition-transform active:scale-95">
                X
              </button>
            </div>

            {/* Alınan Ödemeler Listesi */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6 flex flex-col min-h-[100px] max-h-[140px] overflow-y-auto">
              {alinanOdemeler.length === 0 ? (
                <span className="text-gray-400 font-bold tracking-widest text-xs uppercase pl-2 mt-2">ALINAN ÖDEMELER</span>
              ) : (
                <ul className="flex flex-wrap gap-3 w-full">
                  {alinanOdemeler.map((odeme) => (
                    <li key={odeme.id} className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-bold text-gray-700 border border-gray-200 flex items-center gap-2">
                      <span className="text-gray-500">[{odeme.tip}] {odeme.detay}</span>
                      <span className="text-green-600">{formatFiyat(odeme.tutar)} TL</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-6">
              {/* Left Column */}
              <div className="flex-1 flex flex-col justify-between">
                
                {odemeAktifSekme === 'Kredi Kartı' ? (
                  <div>
                    <label className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-2 block">BANKA SEÇİNİZ</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-gray-800 outline-none focus:border-gray-400 transition-colors shadow-sm"
                      value={odemeSeciliBanka}
                      onChange={(e) => setOdemeSeciliBanka(e.target.value)}
                    >
                      {BANKALAR.map((banka) => <option key={banka} value={banka}>{banka}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-2 block">PARA BİRİMİ SEÇİNİZ</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-gray-800 outline-none focus:border-gray-400 transition-colors shadow-sm"
                      value={odemeSeciliDoviz}
                      onChange={(e) => setOdemeSeciliDoviz(e.target.value)}
                    >
                      {PARA_BIRIMLERI.map((kur) => <option key={kur} value={kur}>{kur}</option>)}
                    </select>
                  </div>
                )}

                {/* Kalan Bakiye Box */}
                <div className="bg-[#E4E7ED] rounded-2xl p-5 border border-gray-300 mt-auto">
                  <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest block mb-1">KALAN BAKİYE</span>
                  <span className="text-4xl font-black text-red-600 tracking-tight">{formatFiyat(kalanOdemeTutari)} <span className="text-xl">TL</span></span>
                </div>
              </div>

              {/* Right Column: Numpad */}
              <div className="w-[280px] flex flex-col gap-3">
                
                <div className="bg-white p-5 rounded-2xl text-right text-3xl font-black border border-gray-200 shadow-sm text-gray-800 flex justify-end items-center relative">
                  <input 
                    type="text" 
                    value={odemeTuslananTutar} 
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9,]/g, '');
                      // Birden fazla virgül girilmesini engelle
                      const parts = val.split(',');
                      if (parts.length > 2) val = parts[0] + ',' + parts.slice(1).join('');
                      setOdemeTuslananTutar(val);
                    }}
                    className="w-full text-right outline-none bg-transparent pr-10 font-black text-3xl"
                    placeholder="0"
                    autoFocus
                  />
                  <span className="text-gray-400 text-xl font-bold absolute right-5 pointer-events-none">TL</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button 
                      key={num} 
                      onClick={() => handleOdemeTuslama(num.toString())} 
                      className="bg-white border border-gray-200 shadow-sm rounded-xl py-3 text-xl font-bold text-gray-800 hover:bg-gray-50 transition-colors active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button onClick={() => handleOdemeTuslama(',')} className="bg-[#D1D5DB] border border-gray-300 shadow-sm rounded-xl py-3 text-2xl font-bold text-gray-800 hover:bg-gray-400 transition-colors active:scale-95">,</button>
                  <button onClick={() => handleOdemeTuslama('0')} className="bg-white border border-gray-200 shadow-sm rounded-xl py-3 text-xl font-bold text-gray-800 hover:bg-gray-50 transition-colors active:scale-95">0</button>
                  <button onClick={handleOdemeSil} className="bg-[#FEE2E2] border border-red-200 shadow-sm rounded-xl py-3 text-lg font-black text-red-600 hover:bg-red-200 transition-colors active:scale-95">SİL</button>
                </div>
                
                <button 
                  onClick={handleOdemeEkle} 
                  className="bg-black text-white py-4 rounded-xl font-black tracking-widest text-md hover:bg-gray-800 transition-colors shadow-lg active:scale-95 uppercase mt-1"
                >
                  ÖDEMEYİ AL
                </button>
              </div>
            </div>

            {/* Bottom Tabs */}
            <div className="flex gap-4 mt-6">
              <button 
                onClick={() => setOdemeAktifSekme('Nakit')}
                className={`flex-1 py-4 rounded-xl font-black tracking-widest uppercase transition-all shadow-sm border ${odemeAktifSekme === 'Nakit' ? 'bg-[#00B14F] border-[#00B14F] text-white shadow-[0_4px_15px_rgba(0,177,79,0.3)]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                NAKİT ÖDEME
              </button>
              <button 
                onClick={() => setOdemeAktifSekme('Kredi Kartı')}
                className={`flex-1 py-4 rounded-xl font-black tracking-widest uppercase transition-all shadow-sm border ${odemeAktifSekme === 'Kredi Kartı' ? 'bg-[#00B14F] border-[#00B14F] text-white shadow-[0_4px_15px_rgba(0,177,79,0.3)]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                KREDİ KARTI
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SATIN ALMA GEÇMİŞİ & İADE DEĞİŞİM MODALI */}
      {showGecmisModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          
          <div className="bg-zinc-900 border border-blue-500/50 p-8 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.2)] w-full max-w-6xl relative h-[85vh] flex flex-col overflow-hidden">
            
            {showIadeYokPopup && (
               <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                 <div className="bg-zinc-900 border border-red-500 p-8 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] flex flex-col items-center gap-6">
                    <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="text-white text-3xl font-black tracking-widest">İADE YOK KNK</span>
                    <button onClick={() => setShowIadeYokPopup(false)} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold tracking-widest text-xs uppercase transition-all">ANLADIM, KAPAT</button>
                 </div>
               </div>
            )}

            {gecmisGorunum === "cek_olustur" && cekOlusturmaDurumu !== "idle" && (
               <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                 
                 {(cekOlusturmaDurumu === "generating" || cekOlusturmaDurumu === "saving") && (
                   <div className="flex flex-col items-center gap-6">
                      <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                      <span className="text-purple-400 text-xl font-light tracking-widest uppercase">
                        {cekOlusturmaDurumu === "generating" ? "ÇEK KODU OLUŞTURULUYOR..." : "VERİTABANINA KAYDEDİLİYOR..."}
                      </span>
                   </div>
                 )}

                 {cekOlusturmaDurumu === "regenerating" && (
                   <div className="flex flex-col items-center gap-6 bg-red-900/20 border border-red-500/50 p-12 rounded-3xl">
                      <svg className="w-20 h-20 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <span className="text-red-400 text-2xl font-bold tracking-widest uppercase text-center">
                        KOD ÇAKIŞMASI TESPİT EDİLDİ!<br/>YENİDEN YAZILIYOR...
                      </span>
                   </div>
                 )}

                 {cekOlusturmaDurumu === "ready" && (
                   <div className="bg-zinc-900 border border-purple-500 p-10 rounded-3xl shadow-[0_0_80px_rgba(168,85,247,0.3)] w-full max-w-lg flex flex-col items-center gap-8 animate-fade-in-up">
                      <h2 className="text-purple-400 text-xl font-bold tracking-widest uppercase border-b border-purple-900/50 pb-4 w-full text-center">
                        PERSONEL ONAYI BEKLENİYOR
                      </h2>
                      
                      <div className="flex flex-col items-center gap-2 bg-black/50 w-full py-6 rounded-2xl border border-gray-800 shadow-inner">
                        <span className="text-gray-500 text-xs tracking-widest font-semibold uppercase">ÜRETİLEN ÇEK KODU</span>
                        <span className="text-white text-4xl font-black tracking-[0.3em]">{cekKodu}</span>
                      </div>

                      <div className="flex justify-between w-full px-4 border-b border-gray-800 pb-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">İŞLEMİ YAPAN</span>
                          <span className="text-gray-200 text-sm font-semibold tracking-widest uppercase">{cekSeciliPersonel}</span>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                          <span className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">TOPLAM TUTAR</span>
                          <span className="text-green-400 text-lg font-black tracking-widest">
                            {formatFiyat(gecmisSiparisler.filter(u => cekSeciliUrunler.includes(u.id)).reduce((t, u) => t + u.fiyat, 0))} TL
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-4 w-full">
                        <button 
                          onClick={() => setCekOlusturmaDurumu("idle")} 
                          className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase"
                        >
                          İPTAL ET
                        </button>
                        <button 
                          onClick={handleCekVeritabaniKaydet} 
                          className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl text-white tracking-widest text-xs font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.5)] uppercase"
                        >
                          ONAYLA VE YAZDIR
                        </button>
                      </div>
                   </div>
                 )}

                 {cekOlusturmaDurumu === "success" && (
                   <div className="flex flex-col items-center gap-6 bg-green-900/20 border border-green-500/50 p-12 rounded-3xl">
                      <svg className="w-20 h-20 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className="text-green-400 text-2xl font-bold tracking-widest uppercase text-center">
                        ÇEK BAŞARIYLA ÜRETİLDİ VE KAYDEDİLDİ!
                      </span>
                   </div>
                 )}

               </div>
            )}

            <div className="flex justify-between items-center mb-6 border-b border-blue-900/50 pb-4 shrink-0">
               <h2 className="text-blue-400 text-xl tracking-widest font-bold uppercase">
                 {gecmisGorunum === "liste" && "MÜŞTERİ SATIN ALMA GEÇMİŞİ"}
                 {gecmisGorunum === "degisim" && "ÜRÜN DEĞİŞİM EKRANI"}
                 {gecmisGorunum === "cek_olustur" && "DEĞİŞİM ÇEKİ OLUŞTUR"}
               </h2>
               <div className="flex gap-4">
                 {(gecmisGorunum === "degisim" || gecmisGorunum === "cek_olustur") && (
                   <button onClick={() => setGecmisGorunum("liste")} className="px-6 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl border border-blue-500/50 transition-all text-xs font-bold tracking-widest uppercase">
                     GERİ DÖN
                   </button>
                 )}
                 <button onClick={gecmisModalKapat} className="px-6 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl border border-red-500/50 transition-all text-xs font-bold tracking-widest uppercase">
                   KAPAT
                 </button>
               </div>
            </div>

            {gecmisGorunum === "liste" && (
              <>
                <div className="flex gap-4 mb-3 shrink-0">
                  <div className="flex-1 relative">
                    <svg className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="TARİH ARA (Örn: 06 AĞUSTOS)..." className="w-full bg-black/50 border border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-white text-[10px] outline-none focus:border-blue-500 tracking-widest uppercase transition-colors" />
                  </div>
                  <div className="flex-1 relative">
                    <svg className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="ÜRÜN GRUBU ARA (Örn: DIŞ GİYİM)..." className="w-full bg-black/50 border border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-white text-[10px] outline-none focus:border-blue-500 tracking-widest uppercase transition-colors" />
                  </div>
                </div>

                <div className="flex gap-4 mb-4 shrink-0">
                  <button 
                    disabled={seciliGecmisSatir === null}
                    onClick={() => setShowIadeYokPopup(true)}
                    className={`flex-1 py-2.5 border rounded-xl text-white tracking-widest text-xs font-bold transition-all ${seciliGecmisSatir !== null ? 'bg-red-600 border-red-500 hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    İade Et
                  </button>
                  <button 
                    disabled={seciliGecmisSatir === null}
                    onClick={() => { setGecmisGorunum("cek_olustur"); setCekSeciliUrunler([]); }}
                    className={`flex-1 py-2.5 border rounded-xl text-white tracking-widest text-xs font-bold transition-all ${seciliGecmisSatir !== null ? 'bg-purple-600 border-purple-500 hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    Değişim Çeki
                  </button>
                  <button 
                    disabled={seciliGecmisSatir === null}
                    onClick={() => setGecmisGorunum("degisim")}
                    className={`flex-1 py-2.5 border rounded-xl text-white tracking-widest text-xs font-bold transition-all ${seciliGecmisSatir !== null ? 'bg-orange-600 border-orange-500 hover:bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    Ürün Değiştir
                  </button>
                </div>

                <div className="bg-[#e6e5df] rounded-2xl flex-1 overflow-auto border border-gray-400 shadow-[inset_0_2px_15px_rgba(0,0,0,0.2)] p-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-300/40 text-gray-800 text-[10px] tracking-widest font-extrabold uppercase">
                        <th className="py-4 px-4 border border-gray-400/60 w-16 text-center">SEÇİM</th>
                        <th className="py-4 px-4 border border-gray-400/60">TARİH</th>
                        <th className="py-4 px-4 border border-gray-400/60">ÜRÜN İSMİ</th>
                        <th className="py-4 px-4 border border-gray-400/60 text-right">TUTAR</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#e6e5df]">
                      {gecmisSiparisler.length > 0 ? (
                        gecmisSiparisler.map((siparis, index) => (
                          <tr 
                            key={index}
                            onClick={() => toggleGecmisSatir(index)}
                            className={`transition-colors text-gray-800 text-xs font-semibold tracking-wider cursor-pointer ${seciliGecmisSatir === index ? 'bg-blue-200/50' : 'hover:bg-black/5'}`}
                          >
                            <td className="py-4 px-4 border border-gray-400/60 text-center">
                              <div className={`w-5 h-5 rounded-full mx-auto border-2 flex items-center justify-center transition-colors ${seciliGecmisSatir === index ? 'border-blue-600 bg-blue-600' : 'border-gray-500 bg-white'}`}>
                                {seciliGecmisSatir === index && <div className="w-2 h-2 bg-white rounded-full"></div>}
                              </div>
                            </td>
                            <td className="py-4 px-4 border border-gray-400/60">{siparis.tarih}</td>
                            <td className="py-4 px-4 border border-gray-400/60">{siparis.urun_ismi}</td>
                            <td className="py-4 px-4 border border-gray-400/60 text-right">{formatFiyat(siparis.tutar)} TL</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-gray-500 font-bold tracking-widest uppercase">
                            MÜŞTERİYE AİT SATIN ALMA GEÇMİŞİ BULUNMAMAKTADIR.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {gecmisGorunum === "cek_olustur" && (
              <div className="flex flex-1 gap-6 h-full overflow-hidden">
                <div className="w-1/2 bg-[#e6e5df] rounded-2xl border border-gray-400 shadow-[inset_0_2px_15px_rgba(0,0,0,0.1)] p-6 flex flex-col relative overflow-hidden">
                   <h3 className="text-gray-800 text-sm font-bold tracking-widest border-b-2 border-gray-400 pb-4 mb-4 uppercase shrink-0">SEPETTEKİ ÜRÜNLER</h3>
                   
                   <div className="flex-1 overflow-auto flex flex-col gap-4 pb-28 pr-2">
                     {sepetUrunleri.length > 0 ? sepetUrunleri.map((urun) => (
                       <div 
                         key={urun.id}
                         onClick={() => toggleCekUrun(urun.id)}
                         className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${cekSeciliUrunler.includes(urun.id) ? 'border-purple-500 bg-white' : 'border-gray-300 bg-white/50 hover:bg-white'}`}
                       >
                         <div className="flex flex-col gap-1">
                           <span className="text-gray-900 font-extrabold text-sm uppercase">{urun.isim}</span>
                           <span className="text-purple-600 text-[10px] tracking-widest font-bold uppercase">{formatFiyat(urun.fiyat)} TL</span>
                         </div>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${cekSeciliUrunler.includes(urun.id) ? 'border-purple-500 bg-purple-500' : 'border-gray-400 bg-transparent'}`}>
                           {cekSeciliUrunler.includes(urun.id) && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                         </div>
                       </div>
                     )) : (
                       <div className="text-center text-gray-500 font-bold uppercase mt-10 tracking-widest">ÇEK OLUŞTURULABİLECEK ÜRÜN BULUNAMADI.</div>
                     )}
                   </div>

                   <div className="absolute bottom-6 right-6 bg-white border-2 border-gray-300 shadow-xl rounded-2xl p-5 flex flex-col items-end min-w-[200px] pointer-events-none">
                     <span className="text-gray-500 text-[10px] tracking-widest font-bold uppercase mb-1">SEÇİLEN: {cekSeciliUrunler.length} ADET</span>
                     <span className="text-gray-400 text-xs tracking-widest font-semibold uppercase mb-0.5">TOPLAM TUTAR</span>
                     <span className="text-gray-900 text-2xl font-black">
                       {formatFiyat(gecmisSiparisler.filter(u => cekSeciliUrunler.includes(u.id)).reduce((t, u) => t + u.fiyat, 0))} TL
                     </span>
                   </div>
                </div>

                <div className="w-1/2 bg-black/40 rounded-2xl border border-gray-700 p-8 flex flex-col justify-between">
                   
                   <div className="flex flex-col gap-8">
                     <div className="flex flex-col gap-2 relative">
                       <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase ml-2">PERSONEL KODU</label>
                       
                       <div 
                         onClick={() => setCekPersonelAcik(!cekPersonelAcik)} 
                         className={`w-full bg-zinc-900 border ${cekPersonelAcik ? 'border-purple-500' : 'border-gray-600'} hover:border-gray-400 rounded-xl px-6 py-5 text-white tracking-widest text-sm uppercase transition-colors cursor-pointer flex justify-between items-center shadow-inner`}
                       >
                         <span className={cekSeciliPersonel ? "text-white" : "text-gray-500"}>{cekSeciliPersonel || "PERSONEL SEÇİNİZ..."}</span>
                         <svg className={`w-5 h-5 text-gray-400 transition-transform ${cekPersonelAcik ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                       </div>

                       {cekPersonelAcik && (
                         <div className="absolute top-[85px] left-0 w-full bg-zinc-800 border border-gray-600 rounded-xl z-20 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                           {personeller.map((personel, idx) => (
                             <button 
                               key={idx}
                               onClick={() => {
                                 setCekSeciliPersonel(`${personel.personel_kodu} - ${personel.isim_soyisim}`);
                                 setCekPersonelAcik(false);
                               }}
                               className="w-full text-left px-6 py-4 border-b border-gray-700/50 hover:bg-white/10 text-gray-300 hover:text-white tracking-widest text-xs uppercase transition-colors last:border-b-0"
                             >
                               {personel.personel_kodu} - {personel.isim_soyisim}
                             </button>
                           ))}
                         </div>
                       )}
                     </div>

                     <div className="flex flex-col gap-2">
                       <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase ml-2">MÜŞTERİ BİLGİLERİ</label>
                       <div className="bg-zinc-900/80 border border-gray-600/50 rounded-xl p-6 flex flex-col gap-2">
                          <span className="text-white text-lg font-light tracking-widest uppercase">
                             {searchResult ? `${searchResult.isim} ${searchResult.soyisim}` : "-"}
                          </span>
                          <span className="text-gray-400 text-sm tracking-widest">
                             {searchResult ? searchResult.telefon : ""}
                          </span>
                       </div>
                     </div>
                   </div>

                   <div className="flex justify-end mt-auto">
                     <button 
                       onClick={handleCekOlusturSistemi}
                       disabled={cekSeciliUrunler.length === 0 || !cekSeciliPersonel}
                       className={`py-5 px-10 rounded-xl font-bold tracking-[0.2em] uppercase text-sm transition-all ${cekSeciliUrunler.length > 0 && cekSeciliPersonel ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed'}`}
                     >
                       ÇEK OLUŞTUR
                     </button>
                   </div>
                </div>

              </div>
            )}

            {gecmisGorunum === "degisim" && (
              <div className="flex flex-1 gap-6 h-full overflow-hidden">
                <div className="w-1/2 bg-[#e6e5df] rounded-2xl border border-gray-400 shadow-[inset_0_2px_15px_rgba(0,0,0,0.1)] p-6 flex flex-col overflow-auto relative">
                   <h3 className="text-gray-800 text-sm font-bold tracking-widest border-b-2 border-gray-400 pb-4 mb-6 uppercase">SEPETTEKİ ÜRÜNLER</h3>
                   
                   <div className="flex flex-col gap-4">
                     {sepetUrunleri.length > 0 ? sepetUrunleri.map((urun) => (
                       <div 
                         key={urun.id}
                         onClick={() => setSeciliDegisimUrun(seciliDegisimUrun === urun.id ? null : urun.id)}
                         className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${seciliDegisimUrun === urun.id ? 'border-orange-500 bg-white' : 'border-gray-300 bg-white/50 hover:bg-white'}`}
                       >
                         <div className="flex flex-col gap-1">
                           <span className="text-gray-900 font-extrabold text-sm uppercase">{urun.isim}</span>
                           <span className="text-orange-600 text-[10px] tracking-widest font-bold uppercase">VARYASYON DEĞİŞİMİ</span>
                         </div>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${seciliDegisimUrun === urun.id ? 'border-orange-500 bg-orange-500' : 'border-gray-400 bg-transparent'}`}>
                           {seciliDegisimUrun === urun.id && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                         </div>
                       </div>
                     )) : (
                       <div className="text-center text-gray-500 font-bold uppercase mt-10 tracking-widest">DEĞİŞİM YAPILABİLECEK ÜRÜN BULUNAMADI.</div>
                     )}
                   </div>
                </div>

                <div className="w-1/2 bg-black/40 rounded-2xl border border-gray-700 p-8 flex flex-col justify-center gap-8">
                   
                   <div className="flex flex-col gap-2">
                     <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase ml-2">YENİ ÜRÜN BARKODU</label>
                     <div className="relative">
                       <svg className="w-6 h-6 text-orange-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                       <input type="text" placeholder="BARKOD OKUTUNUZ..." className="w-full bg-zinc-900 border border-gray-600 focus:border-orange-500 rounded-xl pl-14 pr-4 py-5 text-white outline-none tracking-widest text-sm uppercase transition-colors shadow-inner" autoFocus />
                     </div>
                   </div>

                   <div className="flex flex-col gap-2 relative">
                     <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase ml-2">İADE / DEĞİŞİM NEDENİ</label>
                     
                     <div 
                       onClick={() => setIadeNedeniAcik(!iadeNedeniAcik)} 
                       className={`w-full bg-zinc-900 border ${iadeNedeniAcik ? 'border-orange-500' : 'border-gray-600'} hover:border-gray-400 rounded-xl px-6 py-5 text-white tracking-widest text-sm uppercase transition-colors cursor-pointer flex justify-between items-center shadow-inner`}
                     >
                       <span className={seciliNeden ? "text-white" : "text-gray-500"}>{seciliNeden || "BİR NEDEN SEÇİNİZ..."}</span>
                       <svg className={`w-5 h-5 text-gray-400 transition-transform ${iadeNedeniAcik ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                     </div>

                     {iadeNedeniAcik && (
                       <div className="absolute top-[85px] left-0 w-full bg-zinc-800 border border-gray-600 rounded-xl z-20 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                         {IADE_NEDENLERI.map((neden, idx) => (
                           <button 
                             key={idx}
                             onClick={() => {
                               setSeciliNeden(neden);
                               setIadeNedeniAcik(false);
                             }}
                             className="w-full text-left px-6 py-4 border-b border-gray-700/50 hover:bg-white/10 text-gray-300 hover:text-white tracking-widest text-xs uppercase transition-colors last:border-b-0"
                           >
                             {neden}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>

                   <button 
                     disabled={seciliDegisimUrun === null || !seciliNeden}
                     className={`mt-auto py-5 rounded-xl font-bold tracking-[0.2em] uppercase text-sm transition-all ${seciliDegisimUrun !== null && seciliNeden ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed'}`}
                   >
                     DEĞİŞİMİ ONAYLA
                   </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* HEDİYE ÇEKİ ÖDEME MODALI */}
      {aktifModal === "hediye_ceki_odeme" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="bg-zinc-900 border border-purple-500/50 p-8 rounded-3xl shadow-[0_0_60px_rgba(168,85,247,0.25)] w-full max-w-lg relative flex flex-col gap-6">
            <h2 className="text-purple-400 text-lg tracking-widest font-bold border-b border-purple-900/50 pb-4 uppercase">
              HEDİYE ÇEKİ İLE ÖDEME
            </h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-[10px] tracking-widest font-bold uppercase">ÇEK NUMARASI (KOD)</label>
              <input 
                type="text" 
                placeholder="Örn: U4M0T516" 
                value={odemeCekKodu}
                onChange={(e) => {
                  setOdemeCekKodu(e.target.value);
                  if (odemeCekDurumu !== "bos") setOdemeCekDurumu("bos");
                }}
                className="w-full bg-black/50 border border-gray-600 focus:border-purple-500 rounded-xl p-4 text-white outline-none tracking-widest text-sm uppercase transition-colors"
                autoFocus 
              />
            </div>

            {odemeCekDurumu === "bulundu" && odemeCekBilgi && (
              <div className="bg-green-900/20 border border-green-500/40 rounded-xl p-4 flex flex-col gap-2 text-green-300">
                <span className="text-xs font-bold tracking-widest uppercase">ÇEK DOĞRULANDI - GEÇERLİ BAKİYE:</span>
                <span className="text-2xl font-black text-white">{formatFiyat(odemeCekBilgi.cek_fiyat_tutari)} TL</span>
              </div>
            )}

            {odemeCekDurumu === "bulunamadi" && (
              <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-4 text-red-300 text-xs tracking-widest font-bold uppercase">
                Girdiğiniz numaraya ait geçerli bir çek bulunamadı!
              </div>
            )}

            <div className="flex gap-4 mt-2">
              <button 
                onClick={() => {
                  setAktifModal("none");
                  setOdemeCekKodu("");
                  setOdemeCekDurumu("bos");
                }} 
                className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase"
              >
                {odemeCekDurumu === "bulundu" ? "Kapat" : "İptal"}
              </button>

              {odemeCekDurumu !== "bulundu" ? (
                <button 
                  onClick={handleCekSorgula}
                  disabled={!odemeCekKodu}
                  className={`flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase transition-all ${odemeCekKodu ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                >
                  Sorgula
                </button>
              ) : (
                <button 
                  onClick={() => {
                    alert("Ödeme başarıyla hagiye çeki ile tamamlandı!");
                    setAktifModal("none");
                    setOdemeCekKodu("");
                    setOdemeCekDurumu("bos");
                  }}
                  className="flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-xl text-white tracking-widest text-xs font-bold transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] uppercase"
                >
                  Ödemeyi Tamamla
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POS EKRANI - SATICI VE İŞLEM MODALLARI */}
      {view === "satis_ekrani" && (
        <>
          {!aktifSatici && !isCustomerMode && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in">
              <div className="bg-zinc-900 border border-gray-700 p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-4xl w-full">
                <h2 className="text-white text-2xl tracking-widest font-light mb-8 text-center border-b border-gray-700 pb-4 uppercase">
                  SERVİS VEREN SATICIYI SEÇİNİZ
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {personeller.length > 0 ? (
                    personeller.map((personel) => (
                      <button 
                        key={personel.personel_kodu}
                        onClick={() => setAktifSatici(`${personel.personel_kodu} - ${personel.isim_soyisim}`)}
                        className="py-6 px-4 border border-gray-600 rounded-xl hover:bg-white/10 hover:border-white transition-all text-white tracking-widest font-bold text-sm uppercase flex flex-col gap-2 items-center shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                      >
                        <span className="text-gray-400 text-[10px] bg-black/50 px-3 py-1 rounded-full">{personel.personel_kodu}</span>
                        <span>{personel.isim_soyisim}</span>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-gray-500 py-8 tracking-widest text-sm uppercase">SİSTEMDE TANIMLI PERSONEL BULUNAMADI. LÜTFEN DESTEK KISMINDAN PERSONEL TANIMLAYIN.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {aktifModal !== "none" && aktifModal !== "hediye_ceki_odeme" && aktifModal !== "destek_personel" && aktifModal !== "yonetim_sicil" && aktifModal !== "destek_menu" && aktifModal !== "yonetim_menu" && aktifModal !== "yonetim_hediye_ceki" && aktifModal !== "yonetim_hediye_ceki_onay" && aktifModal !== "odeme_ekrani" && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center animate-fade-in p-4">
              
              {aktifModal === "fiyat_sorgula" && (
                <div className="bg-zinc-900 border border-blue-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.15)] w-full max-w-lg relative">
                  <h2 className="text-blue-400 text-lg tracking-widest font-bold mb-6 border-b border-blue-900/50 pb-4 uppercase">FİYAT SORGULAMA</h2>
                  <input type="text" placeholder="BARKOD OKUTUNUZ..." className="w-full bg-black/50 border border-gray-600 rounded-xl p-4 text-white outline-none focus:border-blue-500 mb-6 tracking-widest" autoFocus />
                  
                  <div className="text-center text-gray-500 py-6 tracking-widest text-sm font-bold uppercase">SİSTEMDE ÜRÜN BULUNAMADI.</div>

                  <button onClick={() => setAktifModal("none")} className="w-full py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">KAPAT</button>
                </div>
              )}

              {aktifModal === "urun_sorgula" && (
                <div className="bg-zinc-900 border border-teal-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(20,184,166,0.15)] w-full max-w-2xl relative">
                  <h2 className="text-teal-400 text-lg tracking-widest font-bold mb-6 border-b border-teal-900/50 pb-4 uppercase">ÜRÜN VE STOK SORGULAMA</h2>
                  <input type="text" placeholder="BARKOD OKUTUNUZ..." className="w-full bg-black/50 border border-gray-600 rounded-xl p-4 text-white outline-none focus:border-teal-500 mb-4 tracking-widest" autoFocus />
                  
                  <div className="text-center text-gray-500 py-6 tracking-widest text-sm font-bold uppercase">SİSTEMDE ÜRÜN BULUNAMADI.</div>

                  <button onClick={() => setAktifModal("none")} className="w-full py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">KAPAT</button>
                </div>
              )}

              {aktifModal === "iskonto" && (
                <div className="bg-zinc-900 border border-orange-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(249,115,22,0.15)] w-full max-w-md relative">
                  <h2 className="text-orange-400 text-lg tracking-widest font-bold mb-6 border-b border-orange-900/50 pb-4 uppercase">İSKONTO (İNDİRİM) UYGULA</h2>
                  <div className="flex gap-4 mb-6">
                    <button className="flex-1 py-3 bg-orange-500/20 border border-orange-500 rounded-xl text-white text-xs tracking-widest font-bold">YÜZDE (%)</button>
                    <button className="flex-1 py-3 border border-gray-600 hover:bg-gray-800 rounded-xl text-gray-400 text-xs tracking-widest font-bold">TUTAR (TL)</button>
                  </div>
                  <input type="number" placeholder="İNDİRİM DEĞERİNİ GİRİNİZ..." className="w-full bg-black/50 border border-gray-600 rounded-xl p-4 text-white outline-none focus:border-orange-500 mb-6 tracking-widest" autoFocus />
                  <div className="flex gap-4">
                    <button onClick={() => setAktifModal("none")} className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">İPTAL</button>
                    <button onClick={() => setAktifModal("none")} className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">UYGULA</button>
                  </div>
                </div>
              )}

              {aktifModal === "satis_iptal" && (
                <div className="bg-zinc-900 border border-red-600/50 p-8 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.2)] w-full max-w-md relative text-center">
                  <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <h2 className="text-white text-xl tracking-widest font-bold mb-4 uppercase">FİŞ İPTALİ</h2>
                  <p className="text-gray-400 font-light text-sm tracking-wide mb-8">Mevcut satışı tamamen iptal etmek ve sepeti boşaltmak istediğinize emin misiniz? (Düşülen stoklar depoya geri eklenecektir)</p>
                  <div className="flex gap-4">
                    <button onClick={() => setAktifModal("none")} className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">HAYIR, VAZGEÇ</button>
                    <button onClick={handleSatisIptal} className="flex-1 py-4 bg-red-600 hover:bg-red-500 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">EVET, İPTAL ET</button>
                  </div>
                </div>
              )}

              {aktifModal === "urun_iptal" && (
                <div className="bg-zinc-900 border border-yellow-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.15)] w-full max-w-md relative">
                  <h2 className="text-yellow-400 text-lg tracking-widest font-bold mb-6 border-b border-yellow-900/50 pb-4 uppercase">ÜRÜN ÇIKART (İPTAL)</h2>
                  <p className="text-gray-400 font-light text-sm tracking-wide mb-4 text-center">Sepetten çıkartmak istediğiniz ürünün barkodunu okutunuz.</p>
                  <input type="text" placeholder="BARKOD OKUTUNUZ..." className="w-full bg-black/50 border border-red-900/30 rounded-xl p-4 text-white outline-none focus:border-yellow-500 mb-6 tracking-widest text-center" autoFocus />
                  <button onClick={() => setAktifModal("none")} className="w-full py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">KAPAT / VAZGEÇ</button>
                </div>
              )}

              {aktifModal === "satisi_beklet" && (
                <div className="bg-zinc-900 border border-cyan-500/50 p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-md relative text-center">
                  <svg className="w-16 h-16 text-cyan-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <h2 className="text-white text-xl tracking-widest font-bold mb-4 uppercase">SATIŞI BEKLET (ASKIYA AL)</h2>
                  <p className="text-gray-400 font-light text-sm tracking-wide mb-6">Mevcut sepeti beklemeye almak istiyor musunuz? İşleme daha sonra <strong className="text-white">Askıdan Çağır</strong> menüsünden devam edebilirsiniz.</p>
                  <input type="text" placeholder="SEPET İÇİN BİR NOT GİRİNİZ (OPSİYONEL)..." className="w-full bg-black/50 border border-gray-600 rounded-xl p-4 text-white outline-none focus:border-cyan-500 mb-6 tracking-widest text-center text-xs" />
                  <div className="flex gap-4">
                    <button onClick={() => setAktifModal("none")} className="flex-1 py-4 border border-gray-600 hover:bg-gray-800 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">İPTAL</button>
                    <button onClick={() => setAktifModal("none")} className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase">ASKIYA AL</button>
                  </div>
                </div>
              )}

              {aktifModal === "askidan_cagir" && (
                <div className="bg-zinc-900 border border-indigo-500/50 p-8 rounded-3xl shadow-[0_0_50px_rgba(99,102,241,0.2)] w-full max-w-6xl relative h-[85vh] flex flex-col">
                  
                  <div className="flex justify-between items-center mb-6 border-b border-indigo-900/50 pb-4 shrink-0">
                     <h2 className="text-indigo-400 text-xl tracking-widest font-bold uppercase">BEKLEYEN (ASKIDAKİ) SEPETLER</h2>
                     <button onClick={() => setAktifModal("none")} className="px-6 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl border border-red-500/50 transition-all text-xs font-bold tracking-widest uppercase">
                       KAPAT
                     </button>
                  </div>

                  <div className="mb-6 shrink-0 relative">
                     <svg className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                     <input type="text" placeholder="SEPET NOTU VEYA MÜŞTERİ ARA..." className="w-full bg-black/50 border border-gray-600 rounded-xl pl-12 pr-4 py-4 text-white text-xs outline-none focus:border-indigo-500 tracking-widest uppercase transition-colors" />
                  </div>

                  <div className="bg-[#e6e5df] rounded-2xl flex-1 overflow-auto border border-gray-400 shadow-[inset_0_2px_15px_rgba(0,0,0,0.2)] p-1 flex items-center justify-center">
                    <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">BEKLEYEN SEPET BULUNAMADI.</span>
                  </div>

                </div>
              )}

              {aktifModal === "kampanya" && (
                <div className="bg-zinc-900 border border-purple-500/50 p-8 rounded-2xl shadow-[0_0_60px_rgba(168,85,247,0.25)] w-full max-w-md relative text-center">
                  <div className="text-6xl mb-6">🎵</div>
                  <h2 className="text-white text-2xl tracking-widest font-bold mb-4 uppercase">ÇOK FAZLA FERDİ TAYFUR DİNLEDİĞİNİ TESPİT ETTİK</h2>
                  <div className="bg-purple-900/30 border border-purple-500/50 rounded-xl p-6 mb-8">
                    <p className="text-purple-300 font-light text-lg tracking-wide">
                      "Umut'u tanıyorsanız size özel <strong className="text-white font-bold">3 AL 5 ÖDE</strong> kampanyası aktif edilmiştir! 🤫💸"
                    </p>
                  </div>
                  <button onClick={() => setAktifModal("none")} className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl text-white tracking-widest text-xs font-bold transition-all uppercase shadow-lg shadow-purple-500/30">
                    ONAYLA
                  </button>
                </div>
              )}
              
            </div>
          )}

          <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 p-8 bg-black/40 border border-gray-700/50 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.05)] backdrop-blur-xl">
            
            <div className="flex flex-col w-full md:w-1/2 gap-4">
              <div className="flex gap-4 items-center">
                {!isCustomerMode && (
                  <button 
                    onClick={() => { changeView("pos_menu"); setAktifSatici(""); }} 
                    className="p-3 border border-gray-600 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center text-white"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                
                <div className="flex-1 flex items-center border border-gray-600 rounded-xl p-3 bg-black/50 relative">
                  <svg className="w-8 h-8 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h4v16H3V4zm6 0h2v16H9V4zm4 0h2v16h-2V4zm4 0h4v16h-4V4z" /></svg>
                  <input 
                    type="text" 
                    value={barkodInput}
                    onChange={(e) => setBarkodInput(e.target.value)}
                    onKeyDown={handleBarkodOkut}
                    placeholder="BARKOD OKUTUNUZ" 
                    className="bg-transparent w-full text-white outline-none placeholder-gray-500 tracking-widest text-sm uppercase"
                    autoFocus
                  />
                  {aktifSatici && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 border border-white/20 px-3 py-1 rounded bg-white/5">
                      <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" /></svg>
                      <span className="text-white/70 text-[10px] tracking-widest">{aktifSatici}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#f0ece1] text-gray-800 flex-1 rounded-2xl min-h-[400px] flex flex-col relative shadow-inner p-4 overflow-hidden">
                {sepetUrunleri.length > 0 ? (
                  <div className="flex-1 overflow-auto flex flex-col gap-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-400 text-[10px] font-bold tracking-widest uppercase">
                          <th className="py-2">Barkod</th>
                          <th className="py-2">Ürün Adı</th>
                          <th className="py-2 text-center">Beden/Renk</th>
                          <th className="py-2 text-center">Miktar</th>
                          <th className="py-2 text-right">Fiyat</th>
                          <th className="py-2 text-right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sepetUrunleri.map((urun, idx) => (
                          <tr key={idx} className="border-b border-gray-300 text-xs font-semibold">
                            <td className="py-3">{urun.barkod}</td>
                            <td className="py-3">{urun.isim}</td>
                            <td className="py-3 text-center">{urun.beden} / {urun.renk}</td>
                            <td className="py-3 text-center">{urun.miktar}</td>
                            <td className="py-3 text-right">{formatFiyat(urun.fiyat)} TL</td>
                            <td className="py-3 text-right">{formatFiyat(urun.fiyat * urun.miktar)} TL</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-auto border-t-2 border-gray-400 pt-4 flex justify-between items-center px-4">
                       <span className="text-sm font-bold tracking-widest uppercase">Genel Toplam:</span>
                       <span className="text-2xl font-black">{formatFiyat(sepetGenelToplam)} TL</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <svg className="w-24 h-24 text-gray-400 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 4h4v16H3V4zm6 0h2v16H9V4zm4 0h2v16h-2V4zm4 0h4v16h-4V4z" /></svg>
                    <span className="text-gray-400 tracking-widest text-sm font-semibold uppercase">BARKOD OKUTMA ALANI</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col w-full md:w-1/2 justify-between">
              
              {!isCustomerMode && (
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {[
                    { id: 1, label: "SATICI KODU", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                    { id: 2, label: "FİYAT", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
                    { id: 3, label: "ÜRÜN", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
                    { id: 4, label: "İSKONTO", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
                  ].map((btn) => (
                    <button 
                      key={btn.id} 
                      onClick={() => handleMenuClick(btn.id)}
                      className="flex flex-col items-center justify-center p-3 border border-gray-600/70 rounded-xl hover:border-gray-300 hover:bg-white/5 transition-all group h-24"
                    >
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={btn.icon} /></svg>
                      <span className="text-[9px] text-center text-gray-400 group-hover:text-white tracking-widest font-medium leading-tight uppercase">{btn.label}</span>
                    </button>
                  ))}

                  <button 
                    onClick={() => setAktifModal("kampanya")}
                    className="flex flex-col items-center justify-center p-3 border border-purple-500/50 bg-purple-600/10 rounded-xl hover:bg-purple-600/20 hover:border-purple-400 transition-all group h-24"
                  >
                    <svg className="w-5 h-5 text-purple-400 group-hover:text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <span className="text-[9px] text-center text-purple-300 group-hover:text-white tracking-widest font-medium leading-tight uppercase">KAMPANYA</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { id: 5, label: "SATIŞ İPTAL", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
                  ...(!isCustomerMode ? [
                    { id: 6, label: "ÜRÜN İPTAL", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
                    { id: 9, label: "SATIŞI BEKLET", icon: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                    { id: 10, label: "ASKIDAN ÇAĞIR", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" }
                  ] : [])
                ].map((btn) => (
                  <button 
                    key={btn.id} 
                    onClick={() => handleMenuClick(btn.id)}
                    className="flex flex-col items-center justify-center p-3 border border-gray-600/70 rounded-xl hover:border-gray-300 hover:bg-white/5 transition-all group h-20"
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={btn.icon} /></svg>
                    <span className="text-[9px] text-center text-gray-400 group-hover:text-white tracking-widest font-medium leading-tight uppercase">{btn.label}</span>
                  </button>
                ))}
              </div>

              {/* YENİ ÖDEME BUTONLARI (Nakit, Kredi Kartı ve Hediye Çeki) */}
              <div className="grid grid-cols-3 gap-4 mt-auto">
                <button 
                  onClick={() => openOdemeEkrani("Nakit")} 
                  className="flex flex-col items-center justify-center p-6 border border-gray-500 rounded-xl hover:bg-green-600/20 hover:border-green-500 transition-all group h-32 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-10 h-10 text-gray-300 group-hover:text-green-400 mb-3 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <span className="text-xs text-gray-300 group-hover:text-white tracking-widest font-semibold z-10 uppercase">NAKİT ÖDEME</span>
                </button>

                <button 
                  onClick={() => openOdemeEkrani("Kredi Kartı")} 
                  className="flex flex-col items-center justify-center p-6 border border-gray-500 rounded-xl hover:bg-blue-600/20 hover:border-blue-500 transition-all group h-32 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-10 h-10 text-gray-300 group-hover:text-blue-400 mb-3 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  <span className="text-xs text-gray-300 group-hover:text-white tracking-widest font-semibold z-10 uppercase">KREDİ KARTI</span>
                </button>

                <button 
                  onClick={() => setAktifModal("hediye_ceki_odeme")} 
                  className="flex flex-col items-center justify-center p-6 border border-purple-500/60 rounded-xl hover:bg-purple-600/20 hover:border-purple-400 transition-all group h-32 relative overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                >
                  <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-10 h-10 text-purple-300 group-hover:text-purple-400 mb-3 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                  <span className="text-xs text-purple-200 group-hover:text-white tracking-widest font-semibold z-10 uppercase">HEDİYE ÇEKİ</span>
                </button>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}