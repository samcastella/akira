"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Save, X, Search } from "lucide-react";

/* ========= Tipos ========= */
export type Food = { id: string; name: string; kcalPer100g: number };
export type MealItem = {
  id: string;
  foodId?: string;
  customName?: string;
  kcalPer100g: number;
  grams: number;
};
export type MealResult = {
  id: string;
  name: string;
  items: MealItem[];
  totalKcal: number;
  createdAt: number;
};

//* ========= Dataset local ========= */
const BASE_FOODS: Food[] = [
{ id: "arroz", name: "Arroz blanco crudo", kcalPer100g: 357 },
{ id: "arroz_cocido", name: "Arroz blanco cocido", kcalPer100g: 130 },
{ id: "pollo_pechuga", name: "Pechuga de pollo", kcalPer100g: 165 },
{ id: "aceite_oliva", name: "Aceite de oliva", kcalPer100g: 884 },
{ id: "cebolla", name: "Cebolla", kcalPer100g: 40 },
{ id: "tomate", name: "Tomate", kcalPer100g: 18 },
{ id: "pimiento_rojo", name: "Pimiento rojo", kcalPer100g: 31 },
{ id: "guisantes", name: "Guisantes", kcalPer100g: 81 },
{ id: "calamar", name: "Calamar", kcalPer100g: 92 },
{ id: "gamba", name: "Gamba", kcalPer100g: 99 },
{ id: "conejo", name: "Conejo", kcalPer100g: 173 },
{ id: "salmon", name: "Salmón", kcalPer100g: 208 },
{ id: "atun", name: "Atún", kcalPer100g: 144 },
{ id: "huevo", name: "Huevo", kcalPer100g: 155 },
{ id: "patata", name: "Patata", kcalPer100g: 77 },
{ id: "zanahoria", name: "Zanahoria", kcalPer100g: 41 },
{ id: "pasta_cocida", name: "Pasta cocida", kcalPer100g: 158 },
{ id: "pan", name: "Pan blanco", kcalPer100g: 265 },
{ id: "lentejas_cocidas", name: "Lentejas cocidas", kcalPer100g: 116 },
{ id: "garbanzos_cocidos", name: "Garbanzos cocidos", kcalPer100g: 164 },
{ id: "brocoli", name: "Brócoli", kcalPer100g: 34 },
{ id: "calabacin", name: "Calabacín", kcalPer100g: 17 },
{ id: "champi", name: "Champiñón", kcalPer100g: 22 },
{ id: "espinacas", name: "Espinacas", kcalPer100g: 23 },
{ id: "maiz", name: "Maíz dulce", kcalPer100g: 86 },
{ id: "chocolate", name: "Chocolate negro 70%", kcalPer100g: 579 },
{ id: "pavo", name: "Pavo (pechuga)", kcalPer100g: 135 },
{ id: "ternera", name: "Ternera magra", kcalPer100g: 217 },
{ id: "cerdo", name: "Cerdo (lomo)", kcalPer100g: 242 },
{ id: "atun_lata", name: "Atún enlatado al natural", kcalPer100g: 116 },
{ id: "yogur", name: "Yogur natural", kcalPer100g: 61 },
{ id: "manzana", name: "Manzana", kcalPer100g: 52 },
{ id: "platano", name: "Plátano", kcalPer100g: 89 },
{ id: "avena", name: "Avena", kcalPer100g: 389 },
{ id: "queso_semicurado", name: "Queso semi-curado", kcalPer100g: 402 },

/* VERDURAS / HORTALIZAS */
{ id: "lechuga", name: "Lechuga", kcalPer100g: 15 },
{ id: "pepino", name: "Pepino", kcalPer100g: 13 },
{ id: "pimiento_verde", name: "Pimiento verde", kcalPer100g: 20 },
{ id: "pimiento_amarillo", name: "Pimiento amarillo", kcalPer100g: 27 },
{ id: "berenjena", name: "Berenjena", kcalPer100g: 24 },
{ id: "coliflor", name: "Coliflor", kcalPer100g: 25 },
{ id: "repollo", name: "Repollo", kcalPer100g: 25 },
{ id: "lombarda", name: "Lombarda", kcalPer100g: 29 },
{ id: "apio", name: "Apio", kcalPer100g: 16 },
{ id: "puerro", name: "Puerro", kcalPer100g: 31 },
{ id: "ajo", name: "Ajo", kcalPer100g: 149 },
{ id: "remolacha", name: "Remolacha", kcalPer100g: 43 },
{ id: "alcachofa", name: "Alcachofa", kcalPer100g: 47 },
{ id: "esparrago_verde", name: "Espárrago verde", kcalPer100g: 20 },
{ id: "esparrago_blanco", name: "Espárrago blanco", kcalPer100g: 18 },
{ id: "calabaza", name: "Calabaza", kcalPer100g: 26 },
{ id: "boniato", name: "Boniato (batata)", kcalPer100g: 86 },
{ id: "pepino_en_vinagre", name: "Pepinillos en vinagre", kcalPer100g: 18 },
{ id: "aceituna_verde", name: "Aceituna verde", kcalPer100g: 145 },
{ id: "aceituna_negra", name: "Aceituna negra", kcalPer100g: 170 },
{ id: "nabos", name: "Nabos", kcalPer100g: 28 },
{ id: "rábano", name: "Rábano", kcalPer100g: 16 },
{ id: "endivia", name: "Endivia", kcalPer100g: 17 },
{ id: "canONigos", name: "Canónigos", kcalPer100g: 21 },
{ id: "rúcula", name: "Rúcula", kcalPer100g: 25 },
{ id: "setas", name: "Setas variadas", kcalPer100g: 24 },
{ id: "sopa_verduras", name: "Sopa de verduras (casera)", kcalPer100g: 40 },

/* FRUTAS */
{ id: "naranja", name: "Naranja", kcalPer100g: 47 },
{ id: "mandarina", name: "Mandarina", kcalPer100g: 53 },
{ id: "pera", name: "Pera", kcalPer100g: 57 },
{ id: "uvas", name: "Uvas", kcalPer100g: 69 },
{ id: "fresa", name: "Fresa", kcalPer100g: 32 },
{ id: "arandanos", name: "Arándanos", kcalPer100g: 57 },
{ id: "frambuesa", name: "Frambuesa", kcalPer100g: 52 },
{ id: "melocoton", name: "Melocotón", kcalPer100g: 39 },
{ id: "nectarina", name: "Nectarina", kcalPer100g: 44 },
{ id: "albaricoque", name: "Albaricoque", kcalPer100g: 48 },
{ id: "ciruela", name: "Ciruela", kcalPer100g: 46 },
{ id: "kiwi", name: "Kiwi", kcalPer100g: 61 },
{ id: "pina", name: "Piña", kcalPer100g: 50 },
{ id: "mango", name: "Mango", kcalPer100g: 60 },
{ id: "papaya", name: "Papaya", kcalPer100g: 43 },
{ id: "sandia", name: "Sandía", kcalPer100g: 30 },
{ id: "melon", name: "Melón", kcalPer100g: 34 },
{ id: "granada", name: "Granada", kcalPer100g: 83 },
{ id: "higo", name: "Higo", kcalPer100g: 74 },
{ id: "chirimoya", name: "Chirimoya", kcalPer100g: 75 },
{ id: "caqui", name: "Caqui", kcalPer100g: 70 },
{ id: "limon", name: "Limón", kcalPer100g: 29 },
{ id: "lima", name: "Lima", kcalPer100g: 30 },
{ id: "pomelo", name: "Pomelo", kcalPer100g: 42 },
{ id: "coco", name: "Coco", kcalPer100g: 354 },
{ id: "aguacate", name: "Aguacate", kcalPer100g: 160 },
{ id: "manzana_asada", name: "Manzana asada", kcalPer100g: 85 },

/* LEGUMBRES (SECAS / COCIDAS) */
{ id: "lenteja_seca", name: "Lenteja (seca)", kcalPer100g: 352 },
{ id: "garbanzo_seco", name: "Garbanzo (seco)", kcalPer100g: 364 },
{ id: "alubia_blanca_cocida", name: "Alubia blanca cocida", kcalPer100g: 114 },
{ id: "alubia_pinta_cocida", name: "Alubia pinta cocida", kcalPer100g: 124 },
{ id: "alubia_roja_cocida", name: "Alubia roja cocida", kcalPer100g: 120 },
{ id: "soja_seca", name: "Soja (seca)", kcalPer100g: 446 },
{ id: "edamame", name: "Edamame (soja verde)", kcalPer100g: 121 },
{ id: "habas_cocidas", name: "Habas cocidas", kcalPer100g: 88 },
{ id: "guisante_congelado", name: "Guisante congelado", kcalPer100g: 78 },
{ id: "tofu_firme", name: "Tofu firme", kcalPer100g: 76 },
{ id: "tempeh", name: "Tempeh", kcalPer100g: 193 },
{ id: "hummus", name: "Hummus", kcalPer100g: 285 },

/* CEREALES Y DERIVADOS */
{ id: "arroz_integral_crudo", name: "Arroz integral crudo", kcalPer100g: 365 },
{ id: "arroz_integral_cocido", name: "Arroz integral cocido", kcalPer100g: 111 },
{ id: "pasta_seca", name: "Pasta seca", kcalPer100g: 371 },
{ id: "espagueti_cocido", name: "Espaguetis cocidos", kcalPer100g: 157 },
{ id: "macarron_cocido", name: "Macarrones cocidos", kcalPer100g: 158 },
{ id: "pan_integral", name: "Pan integral", kcalPer100g: 250 },
{ id: "pan_centeno", name: "Pan de centeno", kcalPer100g: 259 },
{ id: "pan_molde_blanco", name: "Pan de molde blanco", kcalPer100g: 258 },
{ id: "pan_molde_integral", name: "Pan de molde integral", kcalPer100g: 247 },
{ id: "galleta_maria", name: "Galleta María", kcalPer100g: 436 },
{ id: "galleta_digestive", name: "Galleta digestive", kcalPer100g: 488 },
{ id: "harina_trigo", name: "Harina de trigo", kcalPer100g: 364 },
{ id: "harina_maiz", name: "Harina de maíz", kcalPer100g: 365 },
{ id: "harina_garbanzo", name: "Harina de garbanzo", kcalPer100g: 387 },
{ id: "quinoa_cruda", name: "Quinoa (cruda)", kcalPer100g: 368 },
{ id: "quinoa_cocida", name: "Quinoa cocida", kcalPer100g: 120 },
{ id: "couscous_crudo", name: "Cuscús (crudo)", kcalPer100g: 376 },
{ id: "couscous_cocido", name: "Cuscús cocido", kcalPer100g: 112 },
{ id: "bulgur_crudo", name: "Bulgur (crudo)", kcalPer100g: 342 },
{ id: "bulgur_cocido", name: "Bulgur cocido", kcalPer100g: 83 },
{ id: "trigo_sarraceno_cocido", name: "Trigo sarraceno cocido", kcalPer100g: 110 },
{ id: "cebada_perlada_cocida", name: "Cebada perlada cocida", kcalPer100g: 123 },
{ id: "tortilla_trigo", name: "Tortilla de trigo (wrap)", kcalPer100g: 310 },
{ id: "tortilla_maiz", name: "Tortilla de maíz", kcalPer100g: 218 },
{ id: "muesli", name: "Muesli", kcalPer100g: 380 },
{ id: "corn_flakes", name: "Corn flakes", kcalPer100g: 357 },
{ id: "arroz_inflado", name: "Arroz inflado", kcalPer100g: 383 },
{ id: "bizcocho", name: "Bizcocho", kcalPer100g: 360 },
{ id: "magdalena", name: "Magdalena", kcalPer100g: 450 },
{ id: "croissant", name: "Croissant", kcalPer100g: 406 },
{ id: "donut", name: "Dónut glaseado", kcalPer100g: 452 },
{ id: "churros", name: "Churros", kcalPer100g: 511 },
{ id: "porras", name: "Porras", kcalPer100g: 450 },
{ id: "empanada_gallega", name: "Empanada gallega", kcalPer100g: 270 },
{ id: "barrita_cereal", name: "Barrita de cereales", kcalPer100g: 380 },

/* LÁCTEOS Y QUESOS */
{ id: "leche_entera", name: "Leche entera", kcalPer100g: 61 },
{ id: "leche_semidesnatada", name: "Leche semidesnatada", kcalPer100g: 46 },
{ id: "leche_desnatada", name: "Leche desnatada", kcalPer100g: 34 },
{ id: "leche_sin_lactosa", name: "Leche sin lactosa", kcalPer100g: 46 },
{ id: "yogur_griego", name: "Yogur griego natural", kcalPer100g: 97 },
{ id: "yogur_azucarado", name: "Yogur azucarado", kcalPer100g: 94 },
{ id: "kefir", name: "Kéfir", kcalPer100g: 52 },
{ id: "requeson", name: "Requesón", kcalPer100g: 97 },
{ id: "queso_fresco", name: "Queso fresco", kcalPer100g: 145 },
{ id: "mozzarella", name: "Queso mozzarella", kcalPer100g: 280 },
{ id: "queso_cabra", name: "Queso de cabra", kcalPer100g: 364 },
{ id: "queso_manchego_curado", name: "Queso manchego curado", kcalPer100g: 410 },
{ id: "parmesano", name: "Queso parmesano", kcalPer100g: 431 },
{ id: "gouda", name: "Queso gouda", kcalPer100g: 356 },
{ id: "cheddar", name: "Queso cheddar", kcalPer100g: 403 },
{ id: "brie", name: "Queso brie", kcalPer100g: 334 },
{ id: "camembert", name: "Queso camembert", kcalPer100g: 300 },
{ id: "queso_crema", name: "Queso crema para untar", kcalPer100g: 342 },
{ id: "mantequilla", name: "Mantequilla", kcalPer100g: 717 },
{ id: "margarina", name: "Margarina", kcalPer100g: 717 },
{ id: "nata_cocinar", name: "Nata para cocinar (18%)", kcalPer100g: 196 },
{ id: "nata_montar", name: "Nata para montar (35%)", kcalPer100g: 340 },
{ id: "leche_condensada", name: "Leche condensada", kcalPer100g: 321 },
{ id: "helado_vainilla", name: "Helado de vainilla", kcalPer100g: 207 },

/* CARNES Y EMBUTIDOS */
{ id: "pollo_muslo", name: "Muslo de pollo", kcalPer100g: 177 },
{ id: "pollo_ala", name: "Ala de pollo", kcalPer100g: 203 },
{ id: "pavo_fiambre", name: "Fiambre de pavo", kcalPer100g: 110 },
{ id: "ternera_salomillo", name: "Ternera (solomillo)", kcalPer100g: 250 },
{ id: "cerdo_costilla", name: "Costilla de cerdo", kcalPer100g: 320 },
{ id: "cerdo_bacon", name: "Bacon", kcalPer100g: 541 },
{ id: "cordero", name: "Cordero", kcalPer100g: 294 },
{ id: "cabrito", name: "Cabrito", kcalPer100g: 280 },
{ id: "hamburguesa_vacuno", name: "Hamburguesa de vacuno", kcalPer100g: 250 },
{ id: "carne_picada_mixta", name: "Carne picada mixta", kcalPer100g: 240 },
{ id: "higado_ternera", name: "Hígado de ternera", kcalPer100g: 135 },
{ id: "higado_pollo", name: "Hígado de pollo", kcalPer100g: 119 },
{ id: "jamon_serrano", name: "Jamón serrano", kcalPer100g: 241 },
{ id: "jamon_cocido", name: "Jamón cocido", kcalPer100g: 145 },
{ id: "chorizo", name: "Chorizo", kcalPer100g: 455 },
{ id: "salchichon", name: "Salchichón", kcalPer100g: 456 },
{ id: "lomo_embuchado", name: "Lomo embuchado", kcalPer100g: 380 },
{ id: "mortadela", name: "Mortadela", kcalPer100g: 311 },
{ id: "fuet", name: "Fuet", kcalPer100g: 455 },
{ id: "salchicha_fresca", name: "Salchicha fresca", kcalPer100g: 301 },
{ id: "albOndigas_crudas", name: "Albóndigas (carne cruda)", kcalPer100g: 235 },

/* PESCADOS Y MARISCOS */
{ id: "merluza", name: "Merluza", kcalPer100g: 82 },
{ id: "bacalao_fresco", name: "Bacalao fresco", kcalPer100g: 82 },
{ id: "bacalao_salado", name: "Bacalao salado (desalado)", kcalPer100g: 290 },
{ id: "atun_aceite_lata", name: "Atún en aceite (lata)", kcalPer100g: 198 },
{ id: "sardina", name: "Sardina", kcalPer100g: 208 },
{ id: "boqueron", name: "Boquerón", kcalPer100g: 131 },
{ id: "anchoa_aceite", name: "Anchoa en aceite", kcalPer100g: 210 },
{ id: "trucha", name: "Trucha", kcalPer100g: 148 },
{ id: "lubina", name: "Lubina", kcalPer100g: 124 },
{ id: "dorada", name: "Dorada", kcalPer100g: 96 },
{ id: "pez_espada", name: "Pez espada (emperador)", kcalPer100g: 121 },
{ id: "sepia", name: "Sepia", kcalPer100g: 100 },
{ id: "pulpo", name: "Pulpo", kcalPer100g: 82 },
{ id: "mejillon", name: "Mejillón", kcalPer100g: 86 },
{ id: "almeja", name: "Almeja", kcalPer100g: 74 },
{ id: "berberecho", name: "Berberecho", kcalPer100g: 79 },
{ id: "navaja", name: "Navaja", kcalPer100g: 82 },
{ id: "langostino", name: "Langostino", kcalPer100g: 106 },
{ id: "cangrejo", name: "Cangrejo", kcalPer100g: 97 },
{ id: "surimi", name: "Surimi (palitos de cangrejo)", kcalPer100g: 90 },
{ id: "salmon_ahumado", name: "Salmón ahumado", kcalPer100g: 185 },
{ id: "bacalao_ahumado", name: "Bacalao ahumado", kcalPer100g: 117 },

/* HUEVOS Y DERIVADOS */
{ id: "clara_huevo", name: "Clara de huevo", kcalPer100g: 48 },
{ id: "yema_huevo", name: "Yema de huevo", kcalPer100g: 322 },
{ id: "huevo_codorniz", name: "Huevo de codorniz", kcalPer100g: 158 },

/* SALSAS, CONDIMENTOS Y GRASAS */
{ id: "tomate_frito", name: "Tomate frito", kcalPer100g: 90 },
{ id: "salsa_tomate", name: "Salsa de tomate", kcalPer100g: 59 },
{ id: "mayonesa", name: "Mayonesa", kcalPer100g: 680 },
{ id: "alioli", name: "Allioli", kcalPer100g: 720 },
{ id: "ketchup", name: "Ketchup", kcalPer100g: 112 },
{ id: "mostaza", name: "Mostaza", kcalPer100g: 66 },
{ id: "salsa_soja", name: "Salsa de soja", kcalPer100g: 60 },
{ id: "vinagre", name: "Vinagre", kcalPer100g: 20 },
{ id: "aceite_girasol", name: "Aceite de girasol", kcalPer100g: 884 },
{ id: "aceite_coco", name: "Aceite de coco", kcalPer100g: 892 },
{ id: "manteca_cerdo", name: "Manteca de cerdo", kcalPer100g: 902 },
{ id: "pesto", name: "Salsa pesto", kcalPer100g: 450 },
{ id: "bechamel", name: "Bechamel", kcalPer100g: 108 },
{ id: "salsa_yogur", name: "Salsa de yogur", kcalPer100g: 220 },
{ id: "guacamole", name: "Guacamole", kcalPer100g: 170 },
{ id: "tahini", name: "Tahini (sésamo molido)", kcalPer100g: 595 },
{ id: "crema_cacao", name: "Crema de cacao y avellanas", kcalPer100g: 539 },
{ id: "miel", name: "Miel", kcalPer100g: 304 },
{ id: "mermelada", name: "Mermelada", kcalPer100g: 250 },
{ id: "dulce_de_leche", name: "Dulce de leche", kcalPer100g: 315 },
{ id: "sirope_agave", name: "Sirope de ágave", kcalPer100g: 310 },

/* FRUTOS SECOS Y SEMILLAS */
{ id: "almendra", name: "Almendras", kcalPer100g: 579 },
{ id: "nuez", name: "Nueces", kcalPer100g: 654 },
{ id: "avellana", name: "Avellanas", kcalPer100g: 628 },
{ id: "pistacho", name: "Pistachos", kcalPer100g: 560 },
{ id: "cacahuete", name: "Cacahuetes", kcalPer100g: 567 },
{ id: "anacardo", name: "Anacardos", kcalPer100g: 553 },
{ id: "pipa_girasol", name: "Pipas de girasol", kcalPer100g: 584 },
{ id: "pipa_calabaza", name: "Pipas de calabaza", kcalPer100g: 559 },
{ id: "sesamo", name: "Sésamo (ajonjolí)", kcalPer100g: 573 },
{ id: "lino", name: "Semillas de lino", kcalPer100g: 534 },
{ id: "chia", name: "Semillas de chía", kcalPer100g: 486 },
{ id: "crema_cacahuete", name: "Crema de cacahuete", kcalPer100g: 588 },
{ id: "crema_almendra", name: "Crema de almendra", kcalPer100g: 628 },

/* DULCES, POSTRES Y PANADERÍA */
{ id: "turron_duro", name: "Turrón duro", kcalPer100g: 520 },
{ id: "turron_blando", name: "Turrón blando", kcalPer100g: 540 },
{ id: "polvoron", name: "Polvorón", kcalPer100g: 530 },
{ id: "roscon_reyes", name: "Roscón de Reyes", kcalPer100g: 390 },
{ id: "flan_huevo", name: "Flan de huevo", kcalPer100g: 146 },
{ id: "arroz_con_leche", name: "Arroz con leche", kcalPer100g: 147 },
{ id: "natillas", name: "Natillas", kcalPer100g: 122 },
{ id: "yogur_bebible_azucarado", name: "Yogur bebible azucarado", kcalPer100g: 76 },
{ id: "brownie", name: "Brownie", kcalPer100g: 466 },
{ id: "cheesecake", name: "Tarta de queso", kcalPer100g: 321 },
{ id: "tarta_manzana", name: "Tarta de manzana", kcalPer100g: 237 },
{ id: "galleta_chocolate", name: "Galleta con chocolate", kcalPer100g: 495 },
{ id: "croqueta_pollo", name: "Croquetas de pollo", kcalPer100g: 220 },
{ id: "croqueta_jamon", name: "Croquetas de jamón", kcalPer100g: 240 },

/* BEBIDAS (por 100 ml aprox.) */
{ id: "zumo_naranja", name: "Zumo de naranja", kcalPer100g: 44 },
{ id: "refresco_cola", name: "Refresco tipo cola", kcalPer100g: 42 },
{ id: "bebida_energetica", name: "Bebida energética", kcalPer100g: 45 },
{ id: "horchata", name: "Horchata", kcalPer100g: 70 },
{ id: "cerveza", name: "Cerveza", kcalPer100g: 43 },
{ id: "vino_tinto", name: "Vino tinto", kcalPer100g: 85 },
{ id: "cafe_solo", name: "Café solo", kcalPer100g: 2 },
{ id: "cafe_con_leche", name: "Café con leche", kcalPer100g: 35 },
{ id: "te", name: "Té", kcalPer100g: 1 },
{ id: "leche_soja", name: "Bebida de soja", kcalPer100g: 39 },
{ id: "leche_almendra", name: "Bebida de almendra", kcalPer100g: 17 },

/* PLATOS TÍPICOS / PREPARACIONES */
{ id: "tortilla_patatas", name: "Tortilla de patatas", kcalPer100g: 154 },
{ id: "paella_mixta", name: "Paella mixta", kcalPer100g: 180 },
{ id: "cocido_madrileno", name: "Cocido madrileño", kcalPer100g: 112 },
{ id: "fabada", name: "Fabada asturiana", kcalPer100g: 149 },
{ id: "lentejas_estofadas", name: "Lentejas estofadas", kcalPer100g: 116 },
{ id: "gazpacho", name: "Gazpacho", kcalPer100g: 35 },
{ id: "salmorejo", name: "Salmorejo", kcalPer100g: 150 },
{ id: "ensaladilla_rusa", name: "Ensaladilla rusa", kcalPer100g: 210 },
{ id: "calamares_romana", name: "Calamares a la romana", kcalPer100g: 230 },
{ id: "pulpo_gallega", name: "Pulpo a la gallega", kcalPer100g: 110 },
{ id: "bacalao_pilpil", name: "Bacalao al pil-pil", kcalPer100g: 220 },
{ id: "callos_madrileno", name: "Callos a la madrileña", kcalPer100g: 130 },
{ id: "albondigas_salsa", name: "Albóndigas en salsa", kcalPer100g: 190 },
{ id: "empanadillas_atun", name: "Empanadillas de atún", kcalPer100g: 280 },
{ id: "lasana_carne", name: "Lasaña de carne", kcalPer100g: 165 },
{ id: "canelloni", name: "Canelones", kcalPer100g: 166 },
{ id: "pizza_margarita", name: "Pizza margarita", kcalPer100g: 238 },
{ id: "pizza_jamon_queso", name: "Pizza jamón y queso", kcalPer100g: 270 },
{ id: "sandwich_mixto", name: "Sándwich mixto", kcalPer100g: 220 },
{ id: "bocadillo_jamon", name: "Bocadillo de jamón", kcalPer100g: 255 },
{ id: "pure_patata", name: "Puré de patata", kcalPer100g: 110 },
{ id: "crema_calabaza", name: "Crema de calabaza", kcalPer100g: 50 },
{ id: "crema_verduras", name: "Crema de verduras", kcalPer100g: 55 },
{ id: "sopa_pescado", name: "Sopa de pescado", kcalPer100g: 65 },
{ id: "paella_verduras", name: "Paella de verduras", kcalPer100g: 160 },
{ id: "fideua", name: "Fideuá", kcalPer100g: 190 },
{ id: "patatas_bravas", name: "Patatas bravas", kcalPer100g: 196 },
{ id: "patatas_fritas", name: "Patatas fritas", kcalPer100g: 312 },
{ id: "ensalada_campera", name: "Ensalada campera", kcalPer100g: 98 },
{ id: "pisto_manchego", name: "Pisto manchego", kcalPer100g: 95 },
{ id: "menestra_verduras", name: "Menestra de verduras", kcalPer100g: 78 },
{ id: "higaditos_cebolla", name: "Higaditos con cebolla", kcalPer100g: 140 },

/* OTROS COMUNES */
{ id: "tomate_triturado", name: "Tomate triturado", kcalPer100g: 32 },
{ id: "pepperoni", name: "Pepperoni", kcalPer100g: 494 },
{ id: "jamon_york", name: "Jamón de York", kcalPer100g: 145 },
{ id: "patE_campana", name: "Paté de campaña", kcalPer100g: 320 },
{ id: "aceitunas_rellenas", name: "Aceitunas rellenas de anchoa", kcalPer100g: 160 },
{ id: "caparrones", name: "Caparrones (alubia roja seca)", kcalPer100g: 333 },
{ id: "cuscus_integral", name: "Cuscús integral (crudo)", kcalPer100g: 370 },
{ id: "arepa_maiz", name: "Arepa de maíz", kcalPer100g: 219 },
{ id: "tapioca", name: "Tapioca (perlas)", kcalPer100g: 358 },
{ id: "pan_brioche", name: "Pan brioche", kcalPer100g: 313 },
{ id: "pan_hamburguesa", name: "Pan de hamburguesa", kcalPer100g: 270 },
{ id: "cereales_choco", name: "Cereales de desayuno con cacao", kcalPer100g: 390 },
{ id: "pure_manzana", name: "Compota de manzana", kcalPer100g: 68 },
{ id: "salsa_bbq", name: "Salsa barbacoa", kcalPer100g: 132 },
{ id: "salsa_curry", name: "Salsa curry", kcalPer100g: 120 },
{ id: "salsa_tzatziki", name: "Salsa tzatziki", kcalPer100g: 80 },
{ id: "salsa_romesco", name: "Salsa romesco", kcalPer100g: 210 },
{ id: "pAn_pita", name: "Pan de pita", kcalPer100g: 275 },
{ id: "arequipe", name: "Arequipe (dulce de leche)", kcalPer100g: 315 },
{ id: "crema_avellanas", name: "Crema de avellanas", kcalPer100g: 628 },
{ id: "patata_asada", name: "Patata asada", kcalPer100g: 93 },
{ id: "patata_cocida", name: "Patata cocida", kcalPer100g: 87 },
{ id: "boniato_asado", name: "Boniato asado", kcalPer100g: 103 },
{ id: "pimiento_asado", name: "Pimiento asado", kcalPer100g: 82 },
{ id: "berenjena_asada", name: "Berenjena asada", kcalPer100g: 35 },
{ id: "yogur_proteina", name: "Yogur alto en proteína", kcalPer100g: 60 },
{ id: "pan_cristal", name: "Pan de cristal", kcalPer100g: 245 },
{ id: "focaccia", name: "Focaccia", kcalPer100g: 300 },
{ id: "torta_aceite", name: "Torta de aceite", kcalPer100g: 520 },
{ id: "empanadilla_carne", name: "Empanadilla de carne", kcalPer100g: 290 },
{ id: "salchicha_frankfurt", name: "Salchicha tipo Frankfurt", kcalPer100g: 301 },
{ id: "kebab_pollo", name: "Kebab de pollo", kcalPer100g: 215 },
{ id: "falafel", name: "Falafel", kcalPer100g: 333 },
{ id: "tabbouleh", name: "Tabbouleh", kcalPer100g: 120 },
{ id: "tallarines_arroz", name: "Tallarines de arroz cocidos", kcalPer100g: 109 },
{ id: "noodles_trigo", name: "Noodles de trigo cocidos", kcalPer100g: 150 },
{ id: "sushi_maki_salmon", name: "Sushi maki de salmón", kcalPer100g: 140 },
{ id: "sushi_california", name: "Sushi California", kcalPer100g: 160 },
{ id: "tortilla_trigo_integral", name: "Tortilla de trigo integral", kcalPer100g: 300 },
{ id: "pan_ecologico_integral", name: "Pan ecológico integral", kcalPer100g: 245 },
{ id: "patatas_chip", name: "Patatas chips", kcalPer100g: 538 },
{ id: "palomitas", name: "Palomitas (con aceite)", kcalPer100g: 535 },
{ id: "barrita_proteica", name: "Barrita proteica", kcalPer100g: 360 },
{ id: "edulcorante_miel_arce", name: "Sirope de arce", kcalPer100g: 260 },
{ id: "tahini_diluido", name: "Salsa tahini diluida", kcalPer100g: 320 },
{ id: "pate_higado", name: "Paté de hígado", kcalPer100g: 330 }
 ];

/* ========= Utils ========= */
const uid = () => Math.random().toString(36).slice(2);
const clampNum = (n: number, min = 0, max = 1_000_000) =>
  Math.min(max, Math.max(min, n));

/* ========= Autocomplete (compacto) ========= */
function Autocomplete({
  value,
  onChange,
  onPick,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (food: Food) => void;
  options: Food[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-black">
        <Search size={14} className="opacity-70" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full outline-none"
          /* Evita auto-zoom en iOS */
          style={{ fontSize: 16, lineHeight: "22px" }}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--muted)]">Sin resultados</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-sm">{o.name}</span>
                <span className="text-xs text-[var(--muted)]">{o.kcalPer100g} kcal/100g</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ========= Fila: Ingrediente + gramos + borrar ========= */
function IngredientRow({
  foods,
  value,
  onChange,
  onRemove,
}: {
  foods: Food[];
  value: MealItem;
  onChange: (next: MealItem) => void;
  onRemove: () => void;
}) {
  const displayName =
    value.customName ?? foods.find((f) => f.id === value.foodId)?.name ?? "";
  const [query, setQuery] = useState(displayName);

  useEffect(() => {
    setQuery(displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.foodId, value.customName]);

  return (
    <div className="grid grid-cols-[1fr,100px,36px] items-center gap-2">
      {/* Nombre del alimento (autocomplete). Escribir = nombre personalizado */}
      <Autocomplete
        value={query}
        onChange={(v) => {
          setQuery(v);
          onChange({ ...value, customName: v || undefined, foodId: undefined });
        }}
        onPick={(food) => {
          onChange({
            ...value,
            foodId: food.id,
            customName: undefined,
            kcalPer100g: food.kcalPer100g,
          });
          setQuery(food.name);
        }}
        options={foods}
        placeholder="Ingrediente (ej. Arroz)"
      />

      {/* Gramos */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-right"
          value={value.grams}
          onChange={(e) =>
            onChange({
              ...value,
              grams: clampNum(parseFloat(e.target.value || "0"), 0, 100000),
            })
          }
          placeholder="gr"
          aria-label="Gramos"
          /* Evita auto-zoom en iOS */
          style={{ fontSize: 16, lineHeight: "22px" }}
        />
        <span className="text-xs text-[var(--muted)]">g</span>
      </div>

      {/* Eliminar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center rounded-lg border border-[var(--line)] p-2 hover:bg-red-50 hover:text-red-600"
          title="Eliminar ingrediente"
          aria-label="Eliminar ingrediente"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* ========= Modal ========= */
export default function CalorieCalculatorModal({
  isOpen,
  onClose,
  onSave,
  presetFoods,
  initialName = "",
  initialItems,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meal: MealResult) => void;
  presetFoods?: Food[];
  initialName?: string;
  initialItems?: MealItem[];
}) {
  const foods = useMemo(
    () => (presetFoods && presetFoods.length ? presetFoods : BASE_FOODS),
    [presetFoods]
  );

  const [mealName, setMealName] = useState(initialName);
  const [nameErr, setNameErr] = useState<string>("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MealItem[]>(
    initialItems && initialItems.length
      ? initialItems
      : [{ id: uid(), foodId: undefined, customName: "", kcalPer100g: 0, grams: 0 }]
  );

  useEffect(() => {
    if (isOpen) {
      setMealName(initialName);
      setNameErr("");
      setItems(
        initialItems && initialItems.length
          ? initialItems
          : [{ id: uid(), foodId: undefined, customName: "", kcalPer100g: 0, grams: 0 }]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const totals = useMemo(() => {
    const totalKcal = items.reduce(
      (acc, it) => acc + (it.grams * (it.kcalPer100g || 0)) / 100,
      0
    );
    const totalGrams = items.reduce((acc, it) => acc + it.grams, 0);
    return { totalKcal, totalGrams };
  }, [items]);

  function addRow() {
    setItems((prev) => [
      ...prev,
      { id: uid(), foodId: undefined, customName: "", kcalPer100g: 0, grams: 0 },
    ]);
  }
  function removeRow(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }
  function updateRow(id: string, next: MealItem) {
    setItems((prev) => prev.map((x) => (x.id === id ? next : x)));
  }

  // ======= Guardar: nombre obligatorio =======
  function handleSave() {
    const name = (mealName || "").trim();
    if (!name) {
      setNameErr("Escribe un nombre para el plato");
      nameInputRef.current?.focus();
      return;
    }

    const clean = items.filter((it) => (it.customName || it.foodId) && it.grams > 0);

    const payload: MealResult = {
      id: uid(),
      name, // usa exactamente el nombre escrito
      items: clean,
      totalKcal: Math.round(totals.totalKcal),
      createdAt: Date.now(),
    };
    onSave(payload);
  }

  const canSave = mealName.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay (cierra al pulsar fuera) */}
      <button
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
        onClick={onClose}
      />

      {/* Contenedor modal: ~65% viewport width + scroll interno */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 rounded-2xl bg-white shadow-2xl"
        style={{
          width: "65vw",
          maxWidth: "720px",
          minWidth: "320px",
          maxHeight: "85vh",
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--line)] bg-white/95 px-4 py-3 backdrop-blur">
          <h2 className="text-base sm:text-lg font-semibold">Calculadora de calorías</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] p-2 hover:bg-gray-50"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4">
          {/* Nombre del plato (obligatorio) */}
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              Nombre del plato <span className="text-red-600">*</span>
            </label>
            <input
              ref={nameInputRef}
              required
              aria-invalid={!!nameErr}
              aria-describedby={nameErr ? "meal-name-error" : undefined}
              value={mealName}
              onChange={(e) => {
                if (nameErr) setNameErr("");
                setMealName(e.target.value);
              }}
              placeholder="Ej: Hamburguesa"
              className="w-full rounded-lg border px-3 py-2"
              style={{ fontSize: 16, lineHeight: "22px", borderColor: nameErr ? "#ef4444" : "var(--line)" }}
            />
            {nameErr && (
              <p id="meal-name-error" className="mt-1 text-xs text-red-600">
                {nameErr}
              </p>
            )}
          </div>

          {/* Lista de ingredientes (sin cabecera) */}
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="flex flex-col gap-2.5">
              {items.map((it) => (
                <IngredientRow
                  key={it.id}
                  foods={foods}
                  value={it}
                  onChange={(next) => updateRow(it.id, next)}
                  onRemove={() => removeRow(it.id)}
                />
              ))}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                <Plus size={16} /> Añadir ingrediente
              </button>
            </div>
          </div>

          {/* Totales */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--muted)]">
              <span className="mr-4">Peso total: {Math.round(totals.totalGrams)} g</span>
              <span>
                kcal totales: <strong>{Math.round(totals.totalKcal)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white hover:opacity-90 active:opacity-80 ${
                  canSave ? "" : "opacity-50 cursor-not-allowed"
                }`}
                style={{ background: "#16a34a" }}
                title="Añadir la comida al registro"
              >
                <Save size={16} /> Guardar plato
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
