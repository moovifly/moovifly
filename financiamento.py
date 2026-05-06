# airlines_financing_data.py
"""
Dados de Financiamento de Companhias Aéreas - BRT Consolidadora
Extração de: https://business.grupobrt.com.br/brt-financiamentos
"""

# ============================================================================
# COMPANHIAS AÉREAS NACIONAIS
# ============================================================================

AIRLINES_NACIONAL = {
    "azul": {
        "nome": "Azul",
        "iata": "AD",
        "tipo": "Nacional",
        "financiamento": "Em até 10x sem juros e em até 12x com juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Hipercard", "Mastercard", "Visa"]
    },
    "gol": {
        "nome": "Gol",
        "iata": "G3",
        "tipo": "Nacional",
        "financiamento": "Em até 4x sem juros; De 5 a 12x com acréscimo de 1,99% ao mês",
        "cartoes": ["Visa", "Mastercard", "Dinners", "Amex", "ELO", "JCB"]
    },
    "latam": {
        "nome": "LATAM Airlines Brasil",
        "iata": "JJ",
        "tipo": "Nacional",
        "financiamento": "Em até 4x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Hipercard", "Mastercard", "Visa"]
    },
    "voepass": {
        "nome": "VoePass (Passaredo)",
        "iata": "2Z",
        "tipo": "Nacional",
        "financiamento": "Sem informações",
        "cartoes": []
    }
}

# ============================================================================
# COMPANHIAS AÉREAS INTERNACIONAIS
# ============================================================================

AIRLINES_INTERNACIONAL = {
    "aerolineas": {
        "nome": "Aerolineas",
        "iata": "AR",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "aeromexico": {
        "nome": "Aeroméxico",
        "iata": "AM",
        "tipo": "Internacional",
        "financiamento": "Em até 12x sem juros",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "air_canada": {
        "nome": "Air Canada",
        "iata": "AC",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "air_china": {
        "nome": "Air China",
        "iata": "CA",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "air_europa": {
        "nome": "Air Europa",
        "iata": "UX",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "air_france": {
        "nome": "Air France",
        "iata": "AF",
        "tipo": "Internacional",
        "financiamento": "Em até 4x sem juros (GDS)",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "air_new_zealand": {
        "nome": "Air New Zealand",
        "iata": "NZ",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Mastercard", "Visa"]
    },
    "american_airlines": {
        "nome": "American Airlines",
        "iata": "AA",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Hipercard", "Mastercard", "Visa"]
    },
    "ana": {
        "nome": "ANA",
        "iata": "NH",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "avianca": {
        "nome": "Avianca",
        "iata": "AV",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "boa": {
        "nome": "BOA",
        "iata": "OB",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Dinners", "Mastercard", "Visa", "Amex (apenas à vista)"]
    },
    "british_airways": {
        "nome": "British Airways",
        "iata": "BA",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros (voos saindo do BR)",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "cathay_pacific": {
        "nome": "Cathay Pacific",
        "iata": "CX",
        "tipo": "Internacional",
        "financiamento": "Somente pagamento à vista",
        "cartoes": []
    },
    "copa_airlines": {
        "nome": "Copa Airlines",
        "iata": "CM",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "delta": {
        "nome": "Delta",
        "iata": "DL",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Mastercard", "Visa"]
    },
    "el_al": {
        "nome": "El Al",
        "iata": "LY",
        "tipo": "Internacional",
        "financiamento": "Em até 3x sem juros",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "emirates": {
        "nome": "Emirates",
        "iata": "EK",
        "tipo": "Internacional",
        "financiamento": "À vista, ou em 3x, 5x ou 9x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "ethiopian": {
        "nome": "Ethiopian",
        "iata": "ET",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "hahn_air": {
        "nome": "Hahn Air",
        "iata": "HR",
        "tipo": "Internacional",
        "financiamento": "Em 1x",
        "cartoes": ["Visa", "Mastercard"]
    },
    "iberia": {
        "nome": "Iberia",
        "iata": "IB",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros (voos saindo do BR)",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "ita_airways": {
        "nome": "ITA Airways",
        "iata": "AZ",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "jal": {
        "nome": "Japan Air Lines (JAL)",
        "iata": "JL",
        "tipo": "Internacional",
        "financiamento": "Somente à vista",
        "cartoes": []
    },
    "jetsmart": {
        "nome": "JETSMART AIRLINES SPA",
        "iata": "JA",
        "tipo": "Internacional",
        "financiamento": "Em até 6x sem juros",
        "cartoes": ["Mastercard", "Visa", "Dinners"]
    },
    "klm": {
        "nome": "KLM",
        "iata": "KL",
        "tipo": "Internacional",
        "financiamento": "Em até 4x sem juros (GDS)",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "korean_air": {
        "nome": "Korean Air",
        "iata": "KE",
        "tipo": "Internacional",
        "financiamento": "Somente à vista",
        "cartoes": []
    },
    "lufthansa": {
        "nome": "Lufthansa",
        "iata": "LH",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros (GDS) ou 10x (NDC)",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa", "Elo"]
    },
    "qantas": {
        "nome": "Qantas",
        "iata": "QF",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros",
        "cartoes": ["Mastercard", "Visa"]
    },
    "qatar": {
        "nome": "Qatar",
        "iata": "QR",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "royal_air_maroc": {
        "nome": "Royal Air Maroc",
        "iata": "AT",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "singapore_airlines": {
        "nome": "Singapore Airlines",
        "iata": "SQ",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros",
        "cartoes": ["Amex", "Mastercard", "Visa"]
    },
    "sky_airline": {
        "nome": "Sky Airline",
        "iata": "H2",
        "tipo": "Internacional",
        "financiamento": "Em até 3x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "south_african": {
        "nome": "South African",
        "iata": "SA",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "swiss": {
        "nome": "Swiss",
        "iata": "LX",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros (GDS) ou 10x (NDC)",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "taag": {
        "nome": "TAAG",
        "iata": "DT",
        "tipo": "Internacional",
        "financiamento": "Em 4x",
        "cartoes": ["Amex", "Dinners", "Mastercard", "Visa"]
    },
    "tap": {
        "nome": "TAP",
        "iata": "TP",
        "tipo": "Internacional",
        "financiamento": "Em até 10x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    },
    "turkish_airlines": {
        "nome": "Turkish Airlines",
        "iata": "TK",
        "tipo": "Internacional",
        "financiamento": "À vista ou em 5x sem juros",
        "cartoes": ["Amex", "Elo", "Mastercard", "Visa"]
    },
    "united": {
        "nome": "United",
        "iata": "UA",
        "tipo": "Internacional",
        "financiamento": "Em até 5x sem juros",
        "cartoes": ["Amex", "Dinners", "Elo", "Mastercard", "Visa"]
    }
}

# ============================================================================
# RESUMO
# ============================================================================

def contar_companhias():
    """Retorna o total de companhias aéreas"""
    total_nacional = len(AIRLINES_NACIONAL)
    total_internacional = len(AIRLINES_INTERNACIONAL)
    return {
        "nacional": total_nacional,
        "internacional": total_internacional,
        "total": total_nacional + total_internacional
    }

if __name__ == "__main__":
    resumo = contar_companhias()
    print(f"Total de Companhias Aéreas: {resumo['total']}")
    print(f"  - Nacionais: {resumo['nacional']}")
    print(f"  - Internacionais: {resumo['internacional']}")