#!/usr/bin/env bash
# I pacchetti di sistema dei lavori su GitHub (Controlli, fabbrica, prova di uno scrittore): schermo finto, ffmpeg e il
# driver OpenGL software, per registrare i video del risultato.
#
# Le macchine di GitHub scaricano i pacchetti dal mirror Ubuntu di Azure della loro regione. Dal 22 ottobre 2026 quelli
# di westus e westus3 sono spesso lentissimi: il passo, di solito 15-30 secondi, ha preso fino a 31 minuti, e un lavoro
# di Controlli è finito a un passo dal limite di 45. Gli indici arrivano veloci (l'update dura i soliti secondi): sono
# i pacchetti a non arrivare. Quindi:
# 1. una sonda: se il mirror di Azure non consegna in fretta un pacchetto fisso, apt usa subito i server di Canonical;
# 2. indici e scaricamento hanno un tempo massimo: se scade, si riprova dai server di Canonical;
# 3. l'installazione vera parte solo a scaricamento finito (fermare apt a metà installazione romperebbe dpkg).
# Ogni pacchetto resta verificato da apt con le chiavi di Ubuntu, da qualunque server arrivi.

set -euo pipefail

pacchetti=(xvfb ffmpeg libgl1-mesa-dri)
mirror_file=/etc/apt/apt-mirrors.txt

senza_azure() {
  if [ -f "$mirror_file" ] && grep -q 'azure\.archive\.ubuntu\.com' "$mirror_file"; then
    sudo sed -i '/azure\.archive\.ubuntu\.com/d' "$mirror_file"
    echo "Da qui in poi apt scarica dai server di Canonical:"
    cat "$mirror_file"
  fi
}

# Il primo pacchetto di 10-20 MB nell'indice dell'uscita (quello già sulla macchina: non cambia mai). Dal mirror di
# Azure di solito arriva in un decimo di secondo.
mirror_veloce() {
  local mirror codename lista file velocita
  mirror="$(grep -o -m1 'http[^[:space:]]*azure\.archive\.ubuntu\.com[^[:space:]]*' "$mirror_file" 2>/dev/null)" || return 0
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  lista="$(ls /var/lib/apt/lists/*_dists_"${codename}"_main_binary-amd64_Packages* 2>/dev/null | head -1 || true)"
  [ -n "$lista" ] || return 0
  file="$(/usr/lib/apt/apt-helper cat-file "$lista" |
    awk '/^Filename:/ { f = $2 } /^Size:/ && $2 > 10000000 && $2 < 20000000 { print f; exit }' || true)"
  [ -n "$file" ] || return 0
  if ! velocita="$(curl -fsS -o /dev/null --connect-timeout 5 --max-time 10 -w '%{speed_download}' "${mirror%/}/$file")"; then
    echo "::warning::Il mirror Ubuntu di Azure non ha consegnato un pacchetto di prova in 10 secondi"
    return 1
  fi
  velocita="${velocita%.*}"
  echo "Mirror Ubuntu di Azure: $(( velocita / 1000000 )) MB/s"
  if [ "$velocita" -lt 2000000 ]; then
    echo "::warning::Il mirror Ubuntu di Azure è lento"
    return 1
  fi
}

# $1, $2: secondi al massimo per gli indici e per lo scaricamento.
scarica() {
  echo "Indici dei pacchetti (al massimo $1 secondi)…"
  sudo timeout "$1" apt-get update -qq || return 1
  echo "Scaricamento (al massimo $2 secondi)…"
  sudo timeout "$2" apt-get install -y -qq --no-install-recommends --download-only "${pacchetti[@]}" > /dev/null
}

mirror_veloce || senza_azure
if ! scarica 60 90; then
  echo "::warning::Indici o scaricamento dei pacchetti non riusciti in tempo: si riprova dai server di Canonical"
  senza_azure
  scarica 90 180
fi
echo "Installazione…"
sudo apt-get install -y -qq --no-install-recommends --no-download "${pacchetti[@]}" > /dev/null
echo "Pacchetti pronti in $SECONDS secondi."
