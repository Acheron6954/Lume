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
  
  // GEÇMİŞ ARAMA VE FİLTRELEME STATELERİ
  const [dateFilter, setDateFilter] = useState("");
  const [productCodeFilter, setProductCodeFilter] = useState("");

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
  // ÖDEME EKRANI (NAKİT / KREDİ KARTI) STATELERİ VE HESAPLAMALAR
  // ==============================================================
  const [odemeAktifSekme, setOdemeAktifSekme] = useState<"Nakit" | "Kredi Kartı">("Kredi Kartı");
  const [alinanOdemeler, setAlinanOdemeler] = useState<any[]>([]);
  const [odemeTuslananTutar, setOdemeTuslananTutar] = useState("");
  const [odemeSeciliBanka, setOdemeSeciliBanka] = useState(BANKALAR[0]);
  const [odemeSeciliDoviz, setOdemeSeciliDoviz] = useState(PARA_BIRIMLERI[0]);

  const sepetGenelToplam = sepetUrunleri.reduce((acc, curr) => acc + (curr.fiyat * curr.miktar), 0);
  const odenenToplam = alinanOdemeler.reduce((acc, curr) => acc + curr.tutar, 0);
  const kalanOdemeTutari = Math.max(0, sepetGenelToplam - odenenToplam);

  useEffect(() => {
    if (aktifModal === "odeme_ekrani") {
      setOdemeTuslananTutar(kalanOdemeTutari.toFixed(2).replace('.', ','));
    }
  }, [kalanOdemeTutari, aktifModal]);

  // SİPARİŞ GEÇMİŞİNİ TELEFON NUMARASINA GÖRE VERİTABANINDAN ÇEKME
  useEffect(() => {
    async function fetchSiparisGecmisi() {
      if (showGecmisModal && searchResult?.telefon) {
        const { data, error } = await supabase
          .from('satislar')
          .select('*')
          .eq('telefon', searchResult.telefon)
          .order('created_at', { ascending: false });

        if (data && !error) {
          const formattedData = data.map((item: any) => ({
            id: item.id,
            tarih: new Date(item.created_at).toLocaleDateString('tr-TR'),
            urun_ismi: `[${item.urun_kodu}] ${item.urun_adi}`,
            fiyat: item.tutar,
            raw_date: new Date(item.created_at).toISOString().split('T')[0],
            product_code: item.urun_kodu
          }));
          setGecmisSiparisler(formattedData);
        } else {
          setGecmisSiparisler([]);
        }
      }
    }
    fetchSiparisGecmisi();
  }, [showGecmisModal, searchResult]);

  // TARİH VE ÜRÜN KODU FİLTRELEME MANTIĞI
  const filteredSiparisler = gecmisSiparisler.filter(siparis => {
    const matchDate = dateFilter ? siparis.raw_date === dateFilter : true;
    const matchCode = productCodeFilter ? siparis.product_code?.toLowerCase().includes(productCodeFilter.toLowerCase()) : true;
    return matchDate && matchCode;
  });

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

      const yeniStok = varyantData.stok_adeti - 1;
      const { error: updateError } = await supabase
        .from('urun_varyantlari')
        .update({ stok_adeti: yeniStok })
        .eq('barkod', okutulanBarkod);

      if (updateError) {
        alert("STOK GÜNCELLENİRKEN HATA OLUŞTU!");
        return;
      }

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

    if (yeniKalan <= 0.01) { 
      const musteriBilgisi = searchResult ? `${searchResult.isim} ${searchResult.soyisim}` : (isCustomerMode ? "Müşteri Kiosk İşlemi" : "Kayıtsız Müşteri");

      for (const odeme of guncelOdemeler) {
        if (odeme.tip === "Nakit") {
          const { error } = await supabase.from("nakit_odemeler").insert([{
            satici: aktifSatici,
            musteri: musteriBilgisi,
            tutar: odeme.tutar,
            para_birimi: odeme.detay
          }]);
          if (error) alert("NAKİT ÖDEME KAYIT HATASI: " + error.message);
        } else if (odeme.tip === "Kredi Kartı") {
          const { error } = await supabase.from("kredi_karti_odemeler").insert([{
            satici: aktifSatici,
            musteri: musteriBilgisi,
            tutar: odeme.tutar,
            banka_adi: odeme.detay
          }]);
          if (error) alert("KREDİ KARTI KAYIT HATASI: " + error.message);
        }
      }

      for (const urun of sepetUrunleri) {
        const { error } = await supabase.from("satislar").insert([{
          telefon: musteriBilgisi === "Kayıtsız Müşteri" || musteriBilgisi === "Müşteri Kiosk İşlemi" ? "Kayıtsız" : searchResult?.telefon || "Kayıtsız",
          isim: searchResult ? searchResult.isim : "Kayıtsız",
          soyisim: searchResult ? searchResult.soyisim : "Müşteri",
          urun_kodu: urun.urun_kodu || urun.barkod,
          urun_adi: urun.isim,
          tutar: urun.fiyat
        }]);

        if (error) {
          alert("SATIŞ GEÇMİŞİ KAYIT HATASI (Satislar Tablosu): " + error.message);
        }
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
    setAktifModal("none");
  };

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
    setDateFilter("");
    setProductCodeFilter("");
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
      <div className="min-h-screen screen-login flex items-center justify-center font-sans relative overflow-hidden">
        <form
          onSubmit={handleLogin}
          className="relative z-10 login-card p-12 rounded-2xl w-full max-w-md flex flex-col gap-7 animate-fade-in"
        >
          <div className="flex flex-col items-center mb-1">
            <div className="w-14 h-14 rounded-full border login-monogram flex items-center justify-center mb-5">
              <span className="text-2xl font-light tracking-widest">L</span>
            </div>
            <div className="t-text text-4xl font-light tracking-[0.35em] text-center">L'UME</div>
            <div className="login-subtitle text-[10px] tracking-[0.4em] font-semibold uppercase mt-2">
              Yönetim Sistemi
            </div>
          </div>

          <div className="h-px login-divider"></div>

          {loginError && (
            <div className="bg-red-soft t-red b-red-soft p-3 rounded-lg text-xs font-bold text-center tracking-widest uppercase">
              Kullanıcı Adı Veya Şifre Hatalı!
            </div>
          )}

          <div className="flex flex-col gap-3">
            <label className="t-muted text-[10px] tracking-widest font-bold uppercase">
              Mağaza Kodu
            </label>
            <div className="relative">
              <input
                type="text"
                value={loginMagaza}
                onChange={(e) => setLoginMagaza(e.target.value)}
                className="field w-full py-4 px-4 text-sm tracking-widest uppercase"
                placeholder="Örn: LUME-01"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="t-muted text-[10px] tracking-widest font-bold uppercase">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <svg
                className="w-5 h-5 t-faint absolute left-4 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="field w-full py-4 pl-12 pr-4 text-sm tracking-widest"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="t-muted text-[10px] tracking-widest font-bold uppercase">
              Şifre
            </label>
            <div className="relative">
              <svg
                className="w-5 h-5 t-faint absolute left-4 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4"
                />
              </svg>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="field w-full py-4 pl-12 pr-4 text-sm tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-silver mt-2 py-4 rounded-xl font-bold tracking-[0.25em] uppercase text-sm"
          >
            SİSTEME GİRİŞ YAP
          </button>

          <div className="text-center t-faint text-[10px] tracking-[0.3em] font-semibold uppercase">
            {loginMagaza ? `${loginMagaza} • Satış Yönetim Sistemi` : 'LUME • Satış Yönetim Sistemi'}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen screen-hero relative flex items-center justify-start overflow-hidden font-sans">

      <div className="absolute bottom-12 right-16 text-4xl font-light watermark tracking-widest mix-blend-color-burn z-0 pointer-events-none">
        uV.1
      </div>

      {/* SADECE ANA MENÜDE GÖRÜNEN DESTEK VE YÖNETİM BUTONLARI */}
      {view === "home" && (
        <div className="absolute top-12 right-16 flex items-center gap-6 z-20">
          <button onClick={() => setAktifModal("destek_menu")} className="px-6 py-3 border b-blue bg-blue-soft hover-blue hover-brighten t-blue text-[10px] font-bold tracking-[0.2em] rounded-xl transition-all uppercase glow-blue">
            DESTEK
          </button>

          {isAdmin && (
            <button onClick={() => setAktifModal("yonetim_menu")} className="px-6 py-3 border b-red bg-red-soft hover-red hover-brighten t-red text-[10px] font-bold tracking-[0.2em] rounded-xl transition-all uppercase glow-red">
              YÖNETİM
            </button>
          )}
        </div>
      )}

      {view === "home" && (
        <div className="flex gap-12 pl-20 md:pl-40 transition-all duration-500 animate-fade-in z-10">
          <div onClick={() => changeView("pos_menu")} className="menu-item flex flex-col items-center gap-6 group">
            <div className="menu-title text-8xl tracking-widest">
              POS
            </div>
            <div className="menu-pill px-10 py-5 text-lg font-bold tracking-[0.2em] uppercase">
              {t.posSub}
            </div>
          </div>
          <div onClick={() => changeView("erp_menu")} className="menu-item flex flex-col items-center gap-6 group">
            <div className="menu-title text-8xl tracking-widest">
              ERP
            </div>
            <div className="menu-pill px-10 py-5 text-lg font-bold tracking-[0.2em] uppercase">
              {t.erpSub}
            </div>
          </div>
        </div>
      )}

      {view === "pos_menu" && (
        <div className="flex flex-col gap-12 pl-16 md:pl-32 transition-all duration-500 animate-fade-in z-10">
          <button onClick={() => changeView("home")} className="t-faint hover-bright transition-colors tracking-[0.2em] text-xs font-semibold self-start uppercase">
            {t.mainMenu}
          </button>

          <div className="flex gap-12">
            <div onClick={() => changeView("new_customer")} className="menu-item flex flex-col items-center gap-6 group">
              <div className="menu-title text-8xl tracking-widest">
                {t.ncAbbr}
              </div>
              <div className="menu-pill px-10 py-5 text-lg font-bold tracking-[0.2em] uppercase">
                {t.ncFull}
              </div>
            </div>
            <div onClick={() => changeView("default_customer")} className="menu-item flex flex-col items-center gap-6 group">
              <div className="menu-title text-8xl tracking-widest">
                {t.dcAbbr}
              </div>
              <div className="menu-pill px-10 py-5 text-lg font-bold tracking-[0.2em] uppercase">
                {t.dcFull}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "erp_menu" && (
        <div className="flex flex-col gap-12 pl-16 md:pl-32 transition-all duration-500 animate-fade-in z-10">
          <button onClick={() => changeView("home")} className="t-faint hover-bright transition-colors tracking-[0.2em] text-xs font-semibold self-start uppercase">
            {t.mainMenu}
          </button>
          <div className="t-muted tracking-widest font-light text-xl border b-faint p-8 rounded-2xl glass backdrop-blur-sm uppercase">
            {t.erpSoon}
          </div>
        </div>
      )}

      {view === "new_customer" && (
        <div className="flex gap-16 pl-16 md:pl-32 items-center w-full max-w-7xl transition-all duration-700 animate-fade-in z-10">
          <div onClick={() => !isCustomerMode && changeView("pos_menu")} className={`menu-item flex flex-col items-center gap-6 shrink-0 ${!isCustomerMode ? 'cursor-pointer group' : ''}`}>
            <div className="menu-title-active text-8xl tracking-widest">{t.ncAbbr}</div>
            <div className="menu-pill-active px-10 py-5 text-lg font-bold tracking-[0.2em] uppercase">{t.ncFull}</div>
          </div>

          <form onSubmit={cariEkle} className="flex-1 glass backdrop-blur-md border b-line rounded-2xl p-10 shadow-panel relative">

            {kayitBasarili && (
              <div className="absolute inset-0 bg-green-soft2-strong backdrop-blur-sm rounded-2xl flex items-center justify-center t-text text-xl font-light tracking-widest border b-green z-20 uppercase">
                {t.success}
              </div>
            )}

            {kayitZatenVar && (
              <div className="absolute inset-0 bg-blue-soft2-strong backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center t-text border b-blue z-20 uppercase">
                <span className="text-xl font-bold tracking-widest mb-2">MÜŞTERİ KAYDI BULUNDU</span>
                <span className="text-sm font-light tracking-widest">MÜŞTERİ BİLGİLERİNE YÖNLENDİRİLİYOR...</span>
              </div>
            )}

            <div className="flex items-center justify-between py-7 border-b b-faint">
              <div className="flex items-center gap-4 t-text text-sm tracking-[0.2em] font-light uppercase">{t.phone}</div>
              <input
                type="text"
                required
                value={formData.telefon}
                onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                onBlur={(e) => checkPhoneExists(e.target.value)}
                className="field bg-transparent px-5 py-4 w-96 text-base"
              />
            </div>

            <div className="flex items-center justify-between py-7 border-b b-faint">
              <div className="flex items-center gap-4 t-text text-sm tracking-[0.2em] font-light uppercase">{t.firstName}</div>
              <input type="text" required value={formData.isim} onChange={(e) => setFormData({ ...formData, isim: e.target.value })} className="field bg-transparent px-5 py-4 w-96 text-base" />
            </div>

            <div className="flex items-center justify-between py-7 border-b b-faint">
              <div className="flex items-center gap-4 t-text text-sm tracking-[0.2em] font-light uppercase">{t.lastName}</div>
              <input type="text" required value={formData.soyisim} onChange={(e) => setFormData({ ...formData, soyisim: e.target.value })} className="field bg-transparent px-5 py-4 w-96 text-base" />
            </div>

            <div className="flex items-center justify-between py-7 border-b b-faint">
              <div className="flex items-center gap-4 t-text text-sm tracking-[0.2em] font-light uppercase">{t.gender}</div>
              <select value={formData.cinsiyet} onChange={(e) => setFormData({ ...formData, cinsiyet: e.target.value })} className="field bg-transparent px-5 py-4 w-96 text-base appearance-none cursor-pointer">
                <option value="" className="t-ink">{t.select}</option>
                <option value="Kadin" className="t-ink">{t.female}</option>
                <option value="Erkek" className="t-ink">{t.male}</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-7 border-b b-faint">
              <div className="flex items-center gap-4 t-text text-sm tracking-[0.2em] font-light uppercase">{t.birthYear}</div>
              <input type="text" value={formData.dogumYili} onChange={(e) => setFormData({ ...formData, dogumYili: e.target.value })} className="field bg-transparent px-5 py-4 w-96 text-base" />
            </div>

            <div className="w-full flex justify-end mt-6">
              <button type="submit" className="px-8 py-3 border b-glass hover-border-strong rounded-xl t-text text-sm font-bold tracking-[0.2em] transition-all uppercase">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === "default_customer" && (
        <div className="flex gap-16 pl-16 md:pl-32 items-center w-full max-w-6xl transition-all duration-700 animate-fade-in z-10">

          <div onClick={() => changeView("pos_menu")} className="menu-item flex flex-col items-center gap-4 shrink-0 group">
            <div className="menu-title-active text-6xl tracking-widest">{t.dcAbbr}</div>
            <div className="menu-pill-active px-6 py-3 text-[10px] font-bold tracking-[0.2em] uppercase">{t.dcFull}</div>
          </div>

          <div className="flex-1">
            <form onSubmit={cariAra} className="glass backdrop-blur-md border b-line rounded-2xl p-8 shadow-panel mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 t-text text-[10px] tracking-[0.2em] font-light uppercase">{t.searchTitle}</div>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="field bg-transparent px-4 py-2 w-64 text-sm"
                    autoFocus
                  />
                  <button type="submit" className="px-6 py-2 glass-2 border b-glass hover-border-strong rounded-lg t-text text-[10px] font-bold tracking-[0.2em] transition-all uppercase">
                    {t.searchBtn}
                  </button>
                </div>
              </div>
            </form>

            {searchStatus === "found" && searchResult && (
              <div className="glass-2 backdrop-blur-md border b-green-soft rounded-2xl p-8 glow-green flex flex-col gap-4">
                <div className="t-green text-xs tracking-widest font-bold mb-2 uppercase">{t.foundTitle}</div>
                <div className="t-text text-2xl font-light tracking-wide">{searchResult.isim} {searchResult.soyisim}</div>
                <div className="flex gap-8 t-muted text-sm font-light mt-2">
                  <div>{t.lblGender} <span className="t-text">{searchResult.cinsiyet === 'Kadin' ? t.female : (searchResult.cinsiyet === 'Erkek' ? t.male : "-")}</span></div>
                  <div>{t.lblYear} <span className="t-text">{searchResult.dogum_yili || "-"}</span></div>
                  <div>{t.lblReg} <span className="t-text">{new Date(searchResult.created_at).toLocaleDateString("tr-TR")}</span></div>
                </div>

                <div className="flex gap-4 mt-4">
                  <button onClick={() => setShowGecmisModal(true)} className="flex-1 py-3 bg-blue-soft border b-blue hover-blue rounded-xl t-text text-xs font-bold tracking-[0.2em] transition-all uppercase">
                    SATIN ALMA GEÇMİŞİ
                  </button>
                  <button onClick={() => changeView("satis_ekrani")} className="flex-1 py-3 bg-green-soft border b-green hover-green rounded-xl t-text text-xs font-bold tracking-[0.2em] transition-all uppercase">
                    {t.startSale}
                  </button>
                </div>
              </div>
            )}

            {searchStatus === "not_found" && (
              <div className="bg-red-soft backdrop-blur-md border b-red-soft rounded-2xl p-8 flex items-center justify-between">
                <div className="t-red text-sm tracking-widest font-light uppercase">{t.notFound}</div>
                <button onClick={() => changeView("new_customer")} className="px-6 py-2 bg-red-soft2 border b-red hover-red rounded-lg t-text text-[10px] font-bold tracking-[0.2em] transition-all uppercase">
                  {t.createNew} ({t.ncAbbr})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- YENİ DESTEK MENÜSÜ --- */}
      {aktifModal === "destek_menu" && (
        <div className="fixed inset-0 overlay backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="panel border b-blue rounded-3xl w-full max-w-4xl flex flex-col gap-8 p-10 glow-blue">
            <div className="flex justify-between items-center border-b b-faint pb-4 shrink-0">
              <h2 className="t-blue text-2xl tracking-widest font-bold uppercase">DESTEK MENÜSÜ</h2>
              <button onClick={() => setAktifModal("none")} className="px-6 py-2 bg-red-soft t-red hover-red rounded-xl border b-red transition-all text-xs font-bold tracking-widest uppercase">
                KAPAT
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <button onClick={() => setAktifModal("destek_personel")} className="flex flex-col items-center justify-center p-8 border b-blue-soft rounded-2xl hover-blue hover-brighten transition-all group">
                <svg className="w-12 h-12 t-blue mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                <span className="t-text text-xs font-bold tracking-widest uppercase text-center">PERSONEL TANIMLA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESTEK FORMU (Personel Tanımla) */}
      {aktifModal === "destek_personel" && (
        <div className="fixed inset-0 overlay backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <form onSubmit={handlePersonelTalepGonder} className="panel border b-blue p-8 rounded-3xl glow-blue w-full max-w-xl flex flex-col gap-6">
            <h2 className="t-blue text-lg tracking-widest font-bold border-b b-faint pb-4 uppercase">
              PERSONEL TANIMLA
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="t-muted text-[10px] tracking-widest font-bold uppercase">İSİM SOYİSİM</label>
                <input type="text" required value={talepForm.isim_soyisim} onChange={e => setTalepForm({ ...talepForm, isim_soyisim: e.target.value })} className="field p-4 text-sm uppercase" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="t-muted text-[10px] tracking-widest font-bold uppercase">TC KİMLİK NO</label>
                <input type="text" required value={talepForm.tc_no} onChange={e => setTalepForm({ ...talepForm, tc_no: e.target.value })} className="field p-4 text-sm uppercase" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="t-muted text-[10px] tracking-widest font-bold uppercase">DOĞUM TARİHİ</label>
                <input type="date" required value={talepForm.dogum_tarihi} onChange={e => setTalepForm({ ...talepForm, dogum_tarihi: e.target.value })} className="field p-4 text-sm uppercase" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="t-muted text-[10px] tracking-widest font-bold uppercase">TELEFON NU</label>
                <input type="text" required value={talepForm.telefon} onChange={e => setTalepForm({ ...talepForm, telefon: e.target.value })} className="field p-4 text-sm uppercase" />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="t-muted text-[10px] tracking-widest font-bold uppercase">MAĞAZA KODU</label>
              <input type="text" required value={talepForm.magaza_kodu} onChange={e => setTalepForm({ ...talepForm, magaza_kodu: e.target.value })} className="field p-4 text-sm uppercase" />
            </div>

            <div className="flex gap-4 mt-4">
              <button type="button" onClick={() => setAktifModal("destek_menu")} className="btn-ghost flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase">
                İPTAL (GERİ DÖN)
              </button>
              <button type="submit" className="btn-solid bg-blue flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase glow-blue">
                TALEBİ GÖNDER
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- YÖNETİM MENÜSÜ --- */}
      {aktifModal === "yonetim_menu" && (
        <div className="fixed inset-0 overlay backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="panel border b-red p-10 rounded-3xl glow-red w-full max-w-4xl flex flex-col gap-8">
            <div className="flex justify-between items-center border-b b-faint pb-4 shrink-0">
              <h2 className="t-red text-2xl tracking-widest font-bold uppercase">YÖNETİM MENÜSÜ</h2>
              <button onClick={() => setAktifModal("none")} className="px-6 py-2 bg-red-soft t-red hover-red rounded-xl border b-red transition-all text-xs font-bold tracking-widest uppercase">
                KAPAT
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <button onClick={() => { setAktifModal("yonetim_sicil"); fetchTalepler(); }} className="flex flex-col items-center justify-center p-8 border b-red-soft rounded-2xl hover-red hover-brighten transition-all group">
                <svg className="w-12 h-12 t-red mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="t-text text-xs font-bold tracking-widest uppercase text-center">PERSONEL SİCİL KABUL</span>
              </button>
              <button onClick={() => setAktifModal("yonetim_hediye_ceki")} className="flex flex-col items-center justify-center p-8 border b-red-soft rounded-2xl hover-red hover-brighten transition-all group">
                <svg className="w-12 h-12 t-red mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                <span className="t-text text-xs font-bold tracking-widest uppercase text-center">HEDİYE ÇEKİ OLUŞTUR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YÖNETİM HEDİYE ÇEKİ OLUŞTURMA */}
      {aktifModal === "yonetim_hediye_ceki" && (
        <div className="fixed inset-0 overlay-strong backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          <div className="panel border b-red p-8 rounded-3xl glow-red w-full max-w-lg flex flex-col gap-6">
            <h2 className="t-red text-lg tracking-widest font-bold border-b b-faint pb-4 uppercase">
              HEDİYE ÇEKİ OLUŞTUR (YÖNETİM)
            </h2>

            <div className="flex flex-col gap-2">
              <label className="t-muted text-[10px] tracking-widest font-bold uppercase">ÇEK NUMARASI</label>
              <div className="flex gap-4">
                <input
                  type="text"
                  readOnly
                  value={yonetimCekKodu}
                  placeholder="KOD OLUŞTURULMADI"
                  className="field flex-1 p-4 text-sm uppercase cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handleYonetimCekUret}
                  className="px-6 bg-red t-ink btn-solid rounded-xl font-bold tracking-widest text-xs uppercase glow-red"
                >
                  OLUŞTUR
                </button>
              </div>
              {yonetimCekError && <span className="t-red text-[10px] font-bold tracking-widest uppercase mt-1">{yonetimCekError}</span>}
              {isYonetimCekValid && <span className="t-green text-[10px] font-bold tracking-widest uppercase mt-1">KOD KULLANIMA UYGUN</span>}
            </div>

            {isYonetimCekValid && (
              <div className="flex flex-col gap-4 animate-fade-in-up">
                <div className="flex flex-col gap-2">
                  <label className="t-muted text-[10px] tracking-widest font-bold uppercase">KULLANICI (ADMİN)</label>
                  <input type="text" readOnly value="ADMINLUME" className="input-dark w-full border b-faint rounded-xl p-4 t-faint outline-none tracking-widest text-sm font-bold uppercase cursor-not-allowed" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="t-muted text-[10px] tracking-widest font-bold uppercase">ÇEK TUTARI (TL)</label>
                  <input type="number" value={yonetimCekTutar} onChange={e => setYonetimCekTutar(e.target.value)} placeholder="Örn: 500" className="field w-full p-4 text-sm" />
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-4">
              <button
                onClick={() => { setAktifModal("yonetim_menu"); setYonetimCekKodu(""); setYonetimCekTutar(""); setIsYonetimCekValid(false); setYonetimCekError(""); }}
                className="btn-ghost flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase"
              >
                İPTAL (GERİ DÖN)
              </button>
              <button
                disabled={!isYonetimCekValid || !yonetimCekTutar}
                onClick={() => setAktifModal("yonetim_hediye_ceki_onay")}
                className={`flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase transition-all ${isYonetimCekValid && yonetimCekTutar ? 'btn-solid bg-red glow-red' : 'surface-3 t-faint cursor-not-allowed'}`}
              >
                ONAYLA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YÖNETİM HEDİYE ÇEKİ SON ONAY */}
      {aktifModal === "yonetim_hediye_ceki_onay" && (
        <div className="fixed inset-0 overlay-strong backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          <div className="panel border b-red p-8 rounded-3xl glow-red w-full max-w-md flex flex-col gap-6 text-center">
            <svg className="w-16 h-16 t-red mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="t-text text-xl tracking-widest font-bold uppercase">SON ONAY</h2>
            <p className="t-muted text-sm tracking-widest leading-relaxed">
              <strong className="t-text">{yonetimCekKodu}</strong> KODLU VE <strong className="t-green">{yonetimCekTutar} TL</strong> TUTARINDAKİ HEDİYE ÇEKİNİ OLUŞTURMAK İSTEDİĞİNİZE EMİN MİSİNİZ?
            </p>
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => setAktifModal("yonetim_hediye_ceki")}
                className="btn-ghost flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase"
              >
                VAZGEÇ
              </button>
              <button
                onClick={handleYonetimCekKaydet}
                className="btn-solid bg-red flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase glow-red"
              >
                ONAYLA VE OLUŞTUR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YÖNETİM SİCİL KABUL EKRANI */}
      {aktifModal === "yonetim_sicil" && (
        <div className="fixed inset-0 overlay-strong backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">
          <div className="paper p-8 rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col shadow-deep relative overflow-hidden">

            <div className="flex justify-between items-center mb-6 border-b-2 b-paper pb-4 shrink-0">
              <h2 className="t-ink text-2xl tracking-widest font-black uppercase">
                PERSONEL SİCİL KABUL EKRANI
              </h2>
              <button onClick={() => setAktifModal("yonetim_menu")} className="px-8 py-3 bg-red btn-solid rounded-xl text-xs font-bold tracking-widest uppercase shadow-panel">
                KAPAT (GERİ DÖN)
              </button>
            </div>

            <div className="flex-1 overflow-auto border b-paper paper-white rounded-xl inset-paper">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="paper-head text-xs tracking-widest font-extrabold uppercase border-b b-paper">
                    <th className="py-4 px-6 border-r b-paper">İSİM SOYİSİM</th>
                    <th className="py-4 px-6 border-r b-paper">TC KİMLİK NO</th>
                    <th className="py-4 px-6 border-r b-paper">DOĞUM TARİHİ</th>
                    <th className="py-4 px-6 border-r b-paper">TELEFON NU</th>
                    <th className="py-4 px-6 border-r b-paper text-center">MAĞAZA KODU</th>
                    <th className="py-4 px-6 text-center">İŞLEM (ONAY DURUMU)</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium t-ink">
                  {personelTalepleri.length > 0 ? (
                    personelTalepleri.map((talep, idx) => (
                      <tr key={idx} className="border-b b-paper paper-row-hover transition-colors">
                        <td className="py-4 px-6 border-r b-paper">{talep.isim_soyisim}</td>
                        <td className="py-4 px-6 border-r b-paper">{talep.tc_no}</td>
                        <td className="py-4 px-6 border-r b-paper">{talep.dogum_tarihi}</td>
                        <td className="py-4 px-6 border-r b-paper">{talep.telefon}</td>
                        <td className="py-4 px-6 border-r b-paper text-center font-bold t-ink-muted">{talep.magaza_kodu}</td>
                        <td className="py-4 px-6 text-center">
                          <span className="px-4 py-2 bg-yellow-soft t-yellow border b-yellow-soft rounded-lg text-[10px] font-bold uppercase tracking-widest">
                            BEKLEMEDE
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center t-ink-muted font-bold tracking-widest uppercase">
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

      {/* --- PARÇALI ÖDEME MODALI (NAKİT / KREDİ KARTI) --- */}
      {aktifModal === "odeme_ekrani" && (
        <div className="fixed inset-0 overlay backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-4" style={{ zIndex: 9999 }}>

          <div className="pay-panel w-[92vw] max-w-[1150px] rounded-[2rem] p-10 relative flex flex-col font-sans">

            <div className="flex justify-between items-center mb-6">
              <h2 className="pay-header-title text-3xl font-black tracking-widest uppercase">TAHSİLAT EKRANI</h2>
              <button onClick={handleOdemeModalKapat} className="bg-red btn-solid w-10 h-10 rounded-full font-bold flex items-center justify-center text-xl shadow-panel active:scale-95">
                X
              </button>
            </div>

            <div className="pay-list rounded-xl p-4 mb-6 flex flex-col min-h-[120px] max-h-[160px] overflow-y-auto">
              {alinanOdemeler.length === 0 ? (
                <span className="pay-list-label font-bold tracking-widest text-sm uppercase pl-2 mt-2">ALINAN ÖDEMELER</span>
              ) : (
                <ul className="flex flex-wrap gap-3 w-full">
                  {alinanOdemeler.map((odeme) => (
                    <li key={odeme.id} className="pay-item px-4 py-2 rounded-lg text-base font-bold flex items-center gap-2">
                      <span className="pay-item-muted">[{odeme.tip}] {odeme.detay}</span>
                      <span className="t-green">{formatFiyat(odeme.tutar)} TL</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-6">
              <div className="flex-1 flex flex-col justify-between">

                {odemeAktifSekme === 'Kredi Kartı' ? (
                  <div>
                    <label className="pay-label font-bold text-sm uppercase tracking-widest mb-2 block">BANKA SEÇİNİZ</label>
                    <select
                      className="pay-select w-full p-4 rounded-xl font-bold text-base transition-colors"
                      value={odemeSeciliBanka}
                      onChange={(e) => setOdemeSeciliBanka(e.target.value)}
                    >
                      {BANKALAR.map((banka) => <option key={banka} value={banka}>{banka}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="pay-label font-bold text-sm uppercase tracking-widest mb-2 block">PARA BİRİMİ SEÇİNİZ</label>
                    <select
                      className="pay-select w-full p-4 rounded-xl font-bold text-base transition-colors"
                      value={odemeSeciliDoviz}
                      onChange={(e) => setOdemeSeciliDoviz(e.target.value)}
                    >
                      {PARA_BIRIMLERI.map((kur) => <option key={kur} value={kur}>{kur}</option>)}
                    </select>
                  </div>
                )}

                <div className="pay-amount-box rounded-2xl p-6 mt-auto">
                  <span className="pay-label font-bold text-xs uppercase tracking-widest block mb-2">KALAN BAKİYE</span>
                  <span className="pay-amount text-5xl font-black tracking-tight">{formatFiyat(kalanOdemeTutari)} <span className="pay-amount-unit text-2xl">TL</span></span>
                </div>
              </div>

              <div className="w-[320px] flex flex-col gap-3">

                <div className="pay-display p-5 rounded-2xl text-right text-3xl font-black flex justify-end items-center relative">
                  <input
                    type="text"
                    value={odemeTuslananTutar}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9,]/g, '');
                      const parts = val.split(',');
                      if (parts.length > 2) val = parts[0] + ',' + parts.slice(1).join('');
                      setOdemeTuslananTutar(val);
                    }}
                    className="pay-display-input w-full text-right outline-none bg-transparent pr-10 font-black text-4xl"
                    placeholder="0"
                    autoFocus
                  />
                  <span className="pay-amount-unit text-xl font-bold absolute right-5 pointer-events-none">TL</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleOdemeTuslama(num.toString())}
                      className="pay-key rounded-xl py-4 text-2xl font-bold transition-colors active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button onClick={() => handleOdemeTuslama(',')} className="pay-key-comma rounded-xl py-4 text-2xl font-bold transition-colors active:scale-95">,</button>
                  <button onClick={() => handleOdemeTuslama('0')} className="pay-key rounded-xl py-4 text-2xl font-bold transition-colors active:scale-95">0</button>
                  <button onClick={handleOdemeSil} className="pay-key-sil rounded-xl py-4 text-lg font-black transition-colors active:scale-95">SİL</button>
                </div>

                <button
                  onClick={handleOdemeEkle}
                  className="pay-submit py-5 rounded-xl font-black tracking-widest text-lg active:scale-95 uppercase mt-1"
                >
                  ÖDEMEYİ AL
                </button>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setOdemeAktifSekme('Nakit')}
                className={`flex-1 py-5 rounded-xl font-black tracking-widest text-lg uppercase transition-all ${odemeAktifSekme === 'Nakit' ? 'pay-tab-active' : 'pay-tab'}`}
              >
                NAKİT ÖDEME
              </button>
              <button
                onClick={() => setOdemeAktifSekme('Kredi Kartı')}
                className={`flex-1 py-5 rounded-xl font-black tracking-widest text-lg uppercase transition-all ${odemeAktifSekme === 'Kredi Kartı' ? 'pay-tab-active' : 'pay-tab'}`}
              >
                KREDİ KARTI
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SATIN ALMA GEÇMİŞİ & İADE DEĞİŞİM MODALI */}
      {showGecmisModal && (
        <div className="fixed inset-0 overlay backdrop-blur-md z-50 flex items-center justify-center animate-fade-in p-6">

          <div className="panel border b-blue p-8 rounded-3xl glow-blue w-full max-w-6xl relative h-[85vh] flex flex-col overflow-hidden">

            {showIadeYokPopup && (
              <div className="absolute inset-0 overlay backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                <div className="panel border b-red p-8 rounded-2xl glow-red flex flex-col items-center gap-6">
                  <svg className="w-16 h-16 t-red" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span className="t-text text-3xl font-black tracking-widest">İADE YOK KNK</span>
                  <button onClick={() => setShowIadeYokPopup(false)} className="px-8 py-3 bg-red btn-solid rounded-xl font-bold tracking-widest text-xs uppercase glow-red">ANLADIM, KAPAT</button>
                </div>
              </div>
            )}

            {gecmisGorunum === "cek_olustur" && cekOlusturmaDurumu !== "idle" && (
              <div className="absolute inset-0 overlay-strong backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">

                {(cekOlusturmaDurumu === "generating" || cekOlusturmaDurumu === "saving") && (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 spinner-purple animate-spin"></div>
                    <span className="t-purple text-xl font-light tracking-widest uppercase">
                      {cekOlusturmaDurumu === "generating" ? "ÇEK KODU OLUŞTURULUYOR..." : "VERİTABANINA KAYDEDİLİYOR..."}
                    </span>
                  </div>
                )}

                {cekOlusturmaDurumu === "regenerating" && (
                  <div className="flex flex-col items-center gap-6 bg-red-soft border b-red p-12 rounded-3xl">
                    <svg className="w-20 h-20 t-red animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="t-red text-2xl font-bold tracking-widest uppercase text-center">
                      KOD ÇAKIŞMASI TESPİT EDİLDİ!<br />YENİDEN YAZILIYOR...
                    </span>
                  </div>
                )}

                {cekOlusturmaDurumu === "ready" && (
                  <div className="panel border b-purple p-10 rounded-3xl glow-purple w-full max-w-lg flex flex-col items-center gap-8 animate-fade-in-up">
                    <h2 className="t-purple text-xl font-bold tracking-widest uppercase border-b b-faint pb-4 w-full text-center">
                      PERSONEL ONAYI BEKLENİYOR
                    </h2>

                    <div className="flex flex-col items-center gap-2 input-dark w-full py-6 rounded-2xl border b-faint inset-soft">
                      <span className="t-faint text-xs tracking-widest font-semibold uppercase">ÜRETİLEN ÇEK KODU</span>
                      <span className="t-text text-4xl font-black tracking-[0.3em]">{cekKodu}</span>
                    </div>

                    <div className="flex justify-between w-full px-4 border-b b-faint pb-6">
                      <div className="flex flex-col gap-1">
                        <span className="t-faint text-[10px] tracking-widest font-bold uppercase">İŞLEMİ YAPAN</span>
                        <span className="t-bright text-sm font-semibold tracking-widest uppercase">{cekSeciliPersonel}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <span className="t-faint text-[10px] tracking-widest font-bold uppercase">TOPLAM TUTAR</span>
                        <span className="t-green text-lg font-black tracking-widest">
                          {formatFiyat(gecmisSiparisler.filter(u => cekSeciliUrunler.includes(u.id)).reduce((t, u) => t + u.fiyat, 0))} TL
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-4 w-full">
                      <button
                        onClick={() => setCekOlusturmaDurumu("idle")}
                        className="btn-ghost flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase"
                      >
                        İPTAL ET
                      </button>
                      <button
                        onClick={handleCekVeritabaniKaydet}
                        className="btn-solid bg-purple flex-1 py-4 rounded-xl font-bold tracking-widest text-xs uppercase glow-purple"
                      >
                        ONAYLA VE YAZDIR
                      </button>
                    </div>
                  </div>
                )}

                {cekOlusturmaDurumu === "success" && (
                  <div className="flex flex-col items-center gap-6 bg-green-soft border b-green p-12 rounded-3xl">
                    <svg className="w-20 h-20 t-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="t-green text-2xl font-bold tracking-widest uppercase text-center">
                      ÇEK BAŞARIYLA ÜRETİLDİ VE KAYDEDİLDİ!
                    </span>
                  </div>
                )}

              </div>
            )}

            <div className="flex justify-between items-center mb-6 border-b b-faint pb-4 shrink-0">
              <h2 className="t-blue text-xl tracking-widest font-bold uppercase">
                {gecmisGorunum === "liste" && "MÜŞTERİ SATIN ALMA GEÇMİŞİ"}
                {gecmisGorunum === "degisim" && "ÜRÜN DEĞİŞİM EKRANI"}
                {gecmisGorunum === "cek_olustur" && "DEĞİŞİM ÇEKİ OLUŞTUR"}
              </h2>
              <div className="flex gap-4">
                {(gecmisGorunum === "degisim" || gecmisGorunum === "cek_olustur") && (
                  <button onClick={() => setGecmisGorunum("liste")} className="px-6 py-2 bg-blue-soft t-blue hover-blue rounded-xl border b-blue transition-all text-xs font-bold tracking-widest uppercase">
                    GERİ DÖN
                  </button>
                )}
                <button onClick={gecmisModalKapat} className="px-6 py-2 bg-red-soft t-red hover-red rounded-xl border b-red transition-all text-xs font-bold tracking-widest uppercase">
                  KAPAT
                </button>
              </div>
            </div>

            {gecmisGorunum === "liste" && (
              <>
                <div className="flex gap-4 mb-3 shrink-0">
                  <div className="flex-1 relative">
                    <svg className="w-4 h-4 t-faint absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="date" 
                      value={dateFilter} 
                      onChange={(e) => setDateFilter(e.target.value)} 
                      className="field w-full pl-10 pr-4 py-2.5 text-xs uppercase" 
                    />
                  </div>
                  <div className="flex-1 relative">
                    <svg className="w-4 h-4 t-faint absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="text" 
                      value={productCodeFilter} 
                      onChange={(e) => setProductCodeFilter(e.target.value)} 
                      placeholder="ÜRÜN KODU ARA..." 
                      className="field w-full pl-10 pr-4 py-2.5 text-[10px] uppercase" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 mb-4 shrink-0">
                  <button
                    disabled={seciliGecmisSatir === null}
                    onClick={() => setShowIadeYokPopup(true)}
                    className={`flex-1 py-2.5 border rounded-xl t-text tracking-widest text-xs font-bold transition-all ${seciliGecmisSatir !== null ? 'bg-red b-red hover-brighten glow-red' : 'surface-3 b-faint t-faint cursor-not-allowed opacity-50'}`}
                  >
                    İade Et
                  </button>
                  <button
                    disabled={seciliGecmisSatir === null}
                    onClick={() => { setGecmisGorunum("cek_olustur"); setCekSeciliUrunler([]); }}
                    className={`flex-1 py-2.5 border rounded-xl t-text tracking-widest text-xs font-bold transition-all ${seciliGecmisSatir !== null ? 'bg-purple b-purple hover-brighten glow-purple' : 'surface-3 b-faint t-faint cursor-not-allowed opacity-50'}`}
                  >
                    Değişim Çeki
                  </button>
                  <button
                    disabled={seciliGecmisSatir === null}
                    onClick={() => setGecmisGorunum("degisim")}
                    className={`flex-1 py-2.5 border rounded-xl t-text tracking-widest text-xs font-bold transition-all ${seciliGecmisSatir !== null ? 'bg-orange b-orange hover-brighten glow-orange' : 'surface-3 b-faint t-faint cursor-not-allowed opacity-50'}`}
                  >
                    Ürün Değiştir
                  </button>
                </div>

                <div className="paper rounded-2xl flex-1 overflow-auto border b-paper inset-paper p-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="paper-head text-[10px] tracking-widest font-extrabold uppercase">
                        <th className="py-4 px-4 border b-paper w-16 text-center">SEÇİM</th>
                        <th className="py-4 px-4 border b-paper">TARİH</th>
                        <th className="py-4 px-4 border b-paper">ÜRÜN İSMİ</th>
                        <th className="py-4 px-4 border b-paper text-right">TUTAR</th>
                      </tr>
                    </thead>
                    <tbody className="paper">
                      {filteredSiparisler.length > 0 ? (
                        filteredSiparisler.map((siparis, index) => (
                          <tr
                            key={index}
                            onClick={() => toggleGecmisSatir(index)}
                            className={`transition-colors t-ink text-xs font-semibold tracking-wider cursor-pointer ${seciliGecmisSatir === index ? 'bg-blue-soft2' : 'paper-row-hover'}`}
                          >
                            <td className="py-4 px-4 border b-paper text-center">
                              <div className={`w-5 h-5 rounded-full mx-auto border-2 flex items-center justify-center transition-colors ${seciliGecmisSatir === index ? 'b-blue bg-blue' : 'b-paper paper-white'}`}>
                                {seciliGecmisSatir === index && <div className="w-2 h-2 paper-white rounded-full"></div>}
                              </div>
                            </td>
                            <td className="py-4 px-4 border b-paper">{siparis.tarih}</td>
                            <td className="py-4 px-4 border b-paper">{siparis.urun_ismi}</td>
                            <td className="py-4 px-4 border b-paper text-right">{formatFiyat(siparis.fiyat)} TL</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-12 text-center t-ink-muted font-bold tracking-widest uppercase">
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
                <div className="w-1/2 paper rounded-2xl border b-paper inset-paper p-6 flex flex-col relative overflow-hidden">
                  <h3 className="t-ink text-sm font-bold tracking-widest border-b-2 b-paper pb-4 mb-4 uppercase shrink-0">SEPETTEKİ ÜRÜNLER</h3>

                  <div className="flex-1 overflow-auto flex flex-col gap-4 pb-28 pr-2">
                    {sepetUrunleri.length > 0 ? sepetUrunleri.map((urun) => (
                      <div
                        key={urun.id}
                        onClick={() => toggleCekUrun(urun.id)}
                        className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${cekSeciliUrunler.includes(urun.id) ? 'b-purple paper-white' : 'b-paper glass-2 hover-surface'}`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="t-ink font-extrabold text-sm uppercase">{urun.isim}</span>
                          <span className="t-purple text-[10px] tracking-widest font-bold uppercase">{formatFiyat(urun.fiyat)} TL</span>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${cekSeciliUrunler.includes(urun.id) ? 'b-purple bg-purple' : 'b-paper bg-transparent'}`}>
                          {cekSeciliUrunler.includes(urun.id) && <svg className="w-4 h-4 t-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center t-ink-muted font-bold uppercase mt-10 tracking-widest">ÇEK OLUŞTURULABİLECEK ÜRÜN BULUNAMADI.</div>
                    )}
                  </div>

                  <div className="absolute bottom-6 right-6 paper-white border-2 b-paper shadow-panel rounded-2xl p-5 flex flex-col items-end min-w-[200px] pointer-events-none">
                    <span className="t-ink-muted text-[10px] tracking-widest font-bold uppercase mb-1">SEÇİLEN: {cekSeciliUrunler.length} ADET</span>
                    <span className="t-ink-muted text-xs tracking-widest font-semibold uppercase mb-0.5">TOPLAM TUTAR</span>
                    <span className="t-ink text-2xl font-black">
                      {formatFiyat(gecmisSiparisler.filter(u => cekSeciliUrunler.includes(u.id)).reduce((t, u) => t + u.fiyat, 0))} TL
                    </span>
                  </div>
                </div>

                <div className="w-1/2 shell rounded-2xl border b-line p-8 flex flex-col justify-between">

                  <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-2 relative">
                      <label className="t-muted text-[10px] tracking-widest font-bold uppercase ml-2">PERSONEL KODU</label>

                      <div
                        onClick={() => setCekPersonelAcik(!cekPersonelAcik)}
                        className={`w-full surface border ${cekPersonelAcik ? 'b-purple' : 'b-line'} hover-border-strong rounded-xl px-6 py-5 t-text tracking-widest text-sm uppercase transition-colors cursor-pointer flex justify-between items-center inset-soft`}
                      >
                        <span className={cekSeciliPersonel ? "t-text" : "t-faint"}>{cekSeciliPersonel || "PERSONEL SEÇİNİZ..."}</span>
                        <svg className={`w-5 h-5 t-muted transition-transform ${cekPersonelAcik ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>

                      {cekPersonelAcik && (
                        <div className="absolute top-[85px] left-0 w-full surface-2 border b-line rounded-xl z-20 overflow-hidden shadow-panel">
                          {personeller.map((personel, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setCekSeciliPersonel(`${personel.personel_kodu} - ${personel.isim_soyisim}`);
                                setCekPersonelAcik(false);
                              }}
                              className="w-full text-left px-6 py-4 border-b b-faint hover-glass t-bright hover-bright tracking-widest text-xs uppercase transition-colors last:border-b-0"
                            >
                              {personel.personel_kodu} - {personel.isim_soyisim}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="t-muted text-[10px] tracking-widest font-bold uppercase ml-2">MÜŞTERİ BİLGİLERİ</label>
                      <div className="input-dark border b-faint rounded-xl p-6 flex flex-col gap-2">
                        <span className="t-text text-lg font-light tracking-widest uppercase">
                          {searchResult ? `${searchResult.isim} ${searchResult.soyisim}` : "-"}
                        </span>
                        <span className="t-muted text-sm tracking-widest">
                          {searchResult ? searchResult.telefon : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-auto">
                    <button
                      onClick={handleCekOlusturSistemi}
                      disabled={cekSeciliUrunler.length === 0 || !cekSeciliPersonel}
                      className={`py-5 px-10 rounded-xl font-bold tracking-[0.2em] uppercase text-sm transition-all ${cekSeciliUrunler.length > 0 && cekSeciliPersonel ? 'btn-solid bg-purple glow-purple' : 'surface-3 b-faint t-faint cursor-not-allowed'}`}
                    >
                      ÇEK OLUŞTUR
                    </button>
                  </div>
                </div>

              </div>
            )}

            {gecmisGorunum === "degisim" && (
              <div className="flex flex-1 gap-6 h-full overflow-hidden">
                <div className="w-1/2 paper rounded-2xl border b-paper inset-paper p-6 flex flex-col overflow-auto relative">
                  <h3 className="t-ink text-sm font-bold tracking-widest border-b-2 b-paper pb-4 mb-6 uppercase">SEPETTEKİ ÜRÜNLER</h3>

                  <div className="flex flex-col gap-4">
                    {sepetUrunleri.length > 0 ? sepetUrunleri.map((urun) => (
                      <div
                        key={urun.id}
                        onClick={() => setSeciliDegisimUrun(seciliDegisimUrun === urun.id ? null : urun.id)}
                        className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${seciliDegisimUrun === urun.id ? 'b-orange paper-white' : 'b-paper glass-2 hover-surface'}`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="t-ink font-extrabold text-sm uppercase">{urun.isim}</span>
                          <span className="t-orange text-[10px] tracking-widest font-bold uppercase">VARYASYON DEĞİŞİMİ</span>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${seciliDegisimUrun === urun.id ? 'b-orange bg-orange' : 'b-paper bg-transparent'}`}>
                          {seciliDegisimUrun === urun.id && <svg className="w-4 h-4 t-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center t-ink-muted font-bold uppercase mt-10 tracking-widest">DEĞİŞİM YAPILABİLECEK ÜRÜN BULUNAMADI.</div>
                    )}
                  </div>
                </div>

                <div className="w-1/2 shell rounded-2xl border b-line p-8 flex flex-col justify-center gap-8">

                  <div className="flex flex-col gap-2">
                    <label className="t-muted text-[10px] tracking-widest font-bold uppercase ml-2">YENİ ÜRÜN BARKODU</label>
                    <div className="relative">
                      <svg className="w-6 h-6 t-orange absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                      <input type="text" placeholder="BARKOD OKUTUNUZ..." className="field w-full pl-14 pr-4 py-5 text-sm uppercase inset-soft" autoFocus />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 relative">
                    <label className="t-muted text-[10px] tracking-widest font-bold uppercase ml-2">İADE / DEĞİŞİM NEDENİ</label>

                    <div
                      onClick={() => setIadeNedeniAcik(!iadeNedeniAcik)}
                      className={`w-full surface border ${iadeNedeniAcik ? 'b-orange' : 'b-line'} hover-border-strong rounded-xl px-6 py-5 t-text tracking-widest text-sm uppercase transition-colors cursor-pointer flex justify-between items-center inset-soft`}
                    >
                      <span className={seciliNeden ? "t-text" : "t-faint"}>{seciliNeden || "BİR NEDEN SEÇİNİZ..."}</span>
                      <svg className={`w-5 h-5 t-muted transition-transform ${iadeNedeniAcik ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    {iadeNedeniAcik && (
                      <div className="absolute top-[85px] left-0 w-full surface-2 border b-line rounded-xl z-20 overflow-hidden shadow-panel">
                        {IADE_NEDENLERI.map((neden, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSeciliNeden(neden);
                              setIadeNedeniAcik(false);
                            }}
                            className="w-full text-left px-6 py-4 border-b b-faint hover-glass t-bright hover-bright tracking-widest text-xs uppercase transition-colors last:border-b-0"
                          >
                            {neden}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={seciliDegisimUrun === null || !seciliNeden}
                    className={`mt-auto py-5 rounded-xl font-bold tracking-[0.2em] uppercase text-sm transition-all ${seciliDegisimUrun !== null && seciliNeden ? 'btn-solid bg-orange glow-orange' : 'surface-3 b-faint t-faint cursor-not-allowed'}`}
                  >
                    DEĞİŞİMİ ONAYLA
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* POS EKRANI ANA ARAYÜZ (BARKOD / SEPET / BUTONLAR) */}
      {view === "satis_ekrani" && (
        <>
          <div className="w-full max-w-[96%] h-[88vh] mx-auto flex flex-col md:flex-row gap-8 p-10 shell border b-line rounded-3xl shadow-panel backdrop-blur-xl">
            
            <div className="flex flex-col w-full md:w-1/2 gap-6 h-full">
              <div className="flex gap-4 items-center shrink-0">
                {!isCustomerMode && (
                  <button 
                    onClick={() => { changeView("pos_menu"); setAktifSatici(""); }} 
                    className="p-4 border b-strong rounded-xl hover-surface transition-colors flex items-center justify-center t-text"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                
                <div className="flex-1 flex items-center border b-strong rounded-xl p-4 input-dark relative">
                  <svg className="w-8 h-8 t-muted mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h4v16H3V4zm6 0h2v16H9V4zm4 0h2v16h-2V4zm4 0h4v16h-4V4z" /></svg>
                  <input 
                    type="text" 
                    value={barkodInput}
                    onChange={(e) => setBarkodInput(e.target.value)}
                    onKeyDown={handleBarkodOkut}
                    placeholder="BARKOD OKUTUNUZ" 
                    className="bg-transparent w-full t-text outline-none placeholder-faint tracking-widest text-sm uppercase"
                    autoFocus
                  />
                  {aktifSatici && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 border b-glass px-3 py-1 rounded glass">
                      <svg className="w-3 h-3 t-green" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" /></svg>
                      <span className="t-bright text-[10px] tracking-widest">{aktifSatici}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="paper t-ink flex-1 rounded-2xl flex flex-col relative inset-paper p-6 overflow-hidden">
                {sepetUrunleri.length > 0 ? (
                  <div className="flex-1 overflow-auto flex flex-col gap-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 b-paper text-[10px] font-bold tracking-widest uppercase">
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
                          <tr key={idx} className="border-b b-paper text-xs font-semibold">
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
                    <div className="mt-auto border-t-2 b-paper pt-4 flex justify-between items-center px-4">
                       <span className="text-sm font-bold tracking-widest uppercase">Genel Toplam:</span>
                       <span className="text-3xl font-black">{formatFiyat(sepetGenelToplam)} TL</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <svg className="w-28 h-28 t-ink-muted mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 4h4v16H3V4zm6 0h2v16H9V4zm4 0h2v16h-2V4zm4 0h4v16h-4V4z" /></svg>
                    <span className="t-ink-muted tracking-widest text-base font-semibold uppercase">BARKOD OKUTMA ALANI</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col w-full md:w-1/2 justify-between h-full">
              
              {!isCustomerMode && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                  {[
                    { id: 1, label: "SATICI KODU", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                    { id: 2, label: "FİYAT", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
                    { id: 3, label: "ÜRÜN", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
                    { id: 4, label: "İSKONTO", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
                  ].map((btn) => (
                    <button 
                      key={btn.id} 
                      onClick={() => handleMenuClick(btn.id)}
                      className="flex flex-col items-center justify-center p-4 border b-strong rounded-2xl hover-border-strong hover-glass transition-all group h-32"
                    >
                      <svg className="w-8 h-8 t-muted group-hover:t-text mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={btn.icon} /></svg>
                      <span className="text-[10px] text-center t-muted group-hover:t-text tracking-widest font-semibold leading-tight uppercase">{btn.label}</span>
                    </button>
                  ))}

                  <button 
                    onClick={() => setAktifModal("kampanya")}
                    className="flex flex-col items-center justify-center p-4 border b-purple bg-purple-soft rounded-2xl hover-purple hover-brighten transition-all group h-32"
                  >
                    <svg className="w-8 h-8 t-purple group-hover:t-text mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <span className="text-[10px] text-center t-purple group-hover:t-text tracking-widest font-semibold leading-tight uppercase">KAMPANYA</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 mb-6">
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
                    className="flex flex-col items-center justify-center p-4 border b-strong rounded-2xl hover-border-strong hover-glass transition-all group h-28"
                  >
                    <svg className="w-8 h-8 t-muted group-hover:t-text mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={btn.icon} /></svg>
                    <span className="text-[10px] text-center t-muted group-hover:t-text tracking-widest font-semibold leading-tight uppercase">{btn.label}</span>
                  </button>
                ))}
              </div>

              {/* YENİ ÖDEME BUTONLARI (Nakit, Kredi Kartı ve Hediye Çeki) */}
              <div className="grid grid-cols-3 gap-6 mt-auto">
                <button 
                  onClick={() => openOdemeEkrani("Nakit")} 
                  className="flex flex-col items-center justify-center p-8 border b-line rounded-2xl hover-green hover-brighten transition-all group h-40 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-14 h-14 t-bright group-hover:t-green mb-4 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <span className="text-sm t-bright group-hover:t-text tracking-widest font-bold z-10 uppercase">NAKİT ÖDEME</span>
                </button>

                <button 
                  onClick={() => openOdemeEkrani("Kredi Kartı")} 
                  className="flex flex-col items-center justify-center p-8 border b-line rounded-2xl hover-blue hover-brighten transition-all group h-40 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-14 h-14 t-bright group-hover:t-blue mb-4 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  <span className="text-sm t-bright group-hover:t-text tracking-widest font-bold z-10 uppercase">KREDİ KARTI</span>
                </button>

                <button 
                  onClick={() => setAktifModal("hediye_ceki_odeme")} 
                  className="flex flex-col items-center justify-center p-8 border b-purple rounded-2xl hover-purple hover-brighten transition-all group h-40 relative overflow-hidden glow-purple"
                >
                  <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-14 h-14 t-purple group-hover:t-purple mb-4 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                  <span className="text-sm t-purple group-hover:t-text tracking-widest font-bold z-10 uppercase">HEDİYE ÇEKİ</span>
                </button>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}