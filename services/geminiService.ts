import { GoogleGenAI, Type, Modality } from "@google/genai";
import { LocationData, LogisticsPlan, FoodType } from "../types";

export class GaiaAIService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private async callProxy(model: string, parts: any[], config: any): Promise<any> {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, parts, config })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async getRoadGeometry(start: [number, number], end: [number, number]): Promise<[number, number][]> {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      }
    } catch (e) {
      console.error("Routing error:", e);
    }
    return [start, end];
  }

  async generateManualPlan(src: LocationData, dst: LocationData): Promise<LogisticsPlan> {
    console.log(`[GaiaAI] Generating manual plan for ${src.name} -> ${dst.name}`);
    let text: string;
    const prompt = [{ text: `ACT AS A GLOBAL FOOD DISPATCHER. Specific Pair: ${src.name} to ${dst.name}. Coordinates: [${src.lat}, ${src.lng}] to [${dst.lat}, ${dst.lng}]. Food: ${src.foodType} (${src.quantity} svgs available). Need: ${dst.quantity} svgs. Generate a logistics plan for this SPECIFIC pair based on their geographic context.` }];
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          provider: { type: Type.STRING, enum: ['UberDirect', 'DoorDashDrive', 'Volunteer', 'Internal'] },
          estimatedCost: { type: Type.NUMBER },
          estimatedArrival: { type: Type.STRING },
          routeDistance: { type: Type.STRING },
          aiReasoning: { type: Type.STRING },
          matchingScore: { type: Type.NUMBER },
          quantityMoved: { type: Type.NUMBER },
          costPayer: { type: Type.STRING, enum: ['Sender', 'Receiver', 'Split'] }
        },
        required: ["id", "provider", "estimatedArrival", "routeDistance", "aiReasoning", "matchingScore", "quantityMoved", "costPayer"]
      }
    };

    if (this.ai) {
      const result = await this.ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt[0].text,
        config
      });
      text = result.text;
    } else {
      const data = await this.callProxy("gemini-3-pro-preview", prompt, config);
      text = data.text;
    }

    const r = JSON.parse(text || "{}");
    const geometry = await this.getRoadGeometry([src.lat, src.lng], [dst.lat, dst.lng]);

    return {
      ...r,
      sourceId: src.id,
      destinationId: dst.id,
      routeGeometry: geometry,
      inspectionStatus: 'Pending',
      inspectionDetails: { tempChecked: false, sealed: false, specialistCertified: false }
    };
  }

  async dispatchRescue(surplus: LocationData[], demands: LocationData[]): Promise<LogisticsPlan[]> {
    console.log("[GaiaAI] Dispatching rescue matching...");
    let text: string;
    const prompt = [{ text: `ACT AS A GLOBAL FOOD DISPATCHER. Goal: Efficiently match food surplus nodes to demand nodes anywhere in the world. Context: Use the provided latitudes and longitudes to infer distance and urban logistics constraints. Surplus Nodes: ${JSON.stringify(surplus)} Demand Nodes: ${JSON.stringify(demands)}` }];
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            sourceId: { type: Type.STRING },
            destinationId: { type: Type.STRING },
            provider: { type: Type.STRING, enum: ['UberDirect', 'DoorDashDrive', 'Volunteer', 'Internal'] },
            estimatedCost: { type: Type.NUMBER },
            estimatedArrival: { type: Type.STRING },
            routeDistance: { type: Type.STRING },
            aiReasoning: { type: Type.STRING },
            matchingScore: { type: Type.NUMBER },
            quantityMoved: { type: Type.NUMBER },
            costPayer: { type: Type.STRING, enum: ['Sender', 'Receiver', 'Split'] }
          },
          required: ["id", "sourceId", "destinationId", "provider", "estimatedArrival", "routeDistance", "aiReasoning", "matchingScore", "quantityMoved", "costPayer"]
        }
      }
    };

    try {
      if (this.ai) {
        const response = await this.ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: prompt[0].text,
          config
        });
        text = response.text;
      } else {
        const data = await this.callProxy("gemini-3-pro-preview", prompt, config);
        text = data.text;
      }

      const results = JSON.parse(text || "[]");
      const enriched = await Promise.all(results.map(async (r: any) => {
        const src = surplus.find(s => s.id === r.sourceId);
        const dst = demands.find(d => d.id === r.destinationId);
        let geometry: [number, number][] | undefined;
        if (src && dst) {
          geometry = await this.getRoadGeometry([src.lat, src.lng], [dst.lat, dst.lng]);
        }
        return {
          ...r,
          routeGeometry: geometry,
          inspectionStatus: 'Pending',
          inspectionDetails: { tempChecked: false, sealed: false, specialistCertified: false }
        };
      }));
      return enriched;
    } catch (e) {
      console.error("Dispatch AI Error:", e);
      return [];
    }
  }

  async discoverNearbyNodes(lat: number, lng: number): Promise<any[]> {
    const prompt = [{ text: `Find 3 real-world food banks, community kitchens, or NGOs near this location: Lat ${lat}, Lng ${lng}. Use Google Search to find their precise names, descriptions, websites, and coordinates (Lat/Lng).` }];
    const config = {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            description: { type: Type.STRING },
            website: { type: Type.STRING }
          },
          required: ["name", "lat", "lng", "description", "website"]
        }
      }
    };

    try {
      if (this.ai) {
        const response = await this.ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt[0].text,
          config
        });
        return JSON.parse(response.text || "[]");
      } else {
        const data = await this.callProxy("gemini-3-flash-preview", prompt, config);
        return JSON.parse(data.text || "[]");
      }
    } catch (e) {
      console.error("Discovery AI Error:", e);
      return [];
    }
  }

  async analyzeFoodImage(base64: string, mimeType: string = "image/jpeg"): Promise<any> {
    console.log(`[GaiaAI] Analyzing image (${mimeType}, len: ${base64.length})...`);
    let text: string;
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dishName: { type: Type.STRING },
          manifest: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          shelfLife: { type: Type.STRING },
          foodType: { type: Type.STRING },
          safetyRating: { type: Type.STRING },
          co2Impact: { type: Type.NUMBER }
        },
        required: ["dishName", "manifest", "quantity", "shelfLife", "foodType", "safetyRating", "co2Impact"]
      }
    };
    const contents = [
      { inlineData: { mimeType, data: base64 } },
      { text: "Analyze food surplus image for rescue. Return JSON: dishName, manifest, quantity, shelfLife, foodType, safetyRating, co2Impact." }
    ];

    try {
      if (this.ai) {
        const response = await this.ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents,
          config
        });
        text = response.text;
      } else {
        const data = await this.callProxy("gemini-3-flash-preview", contents, config);
        text = data.text;
      }
      return JSON.parse(text || "{}");
    } catch (e: any) {
      console.error("[GaiaAI] analyzeFoodImage detailed error:", e);
      throw e;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<{ name: string }> {
    let text: string;
    const prompt = [{ text: `Generic neighborhood or landmark name for these coordinates: Lat ${lat}, Lng ${lng}.` }];
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING } },
        required: ["name"]
      }
    };

    if (this.ai) {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt[0].text,
        config
      });
      text = response.text;
    } else {
      const data = await this.callProxy("gemini-3-flash-preview", prompt, config);
      text = data.text;
    }
    return JSON.parse(text || "{}");
  }

  async geocode(query: string): Promise<{ lat: number, lng: number, name: string } | null> {
    let text: string;
    const prompt = [{ text: `Find the precise coordinates for this location/city: "${query}".` }];
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          name: { type: Type.STRING }
        },
        required: ["lat", "lng", "name"]
      }
    };

    try {
      if (this.ai) {
        const response = await this.ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt[0].text,
          config
        });
        text = response.text;
      } else {
        const data = await this.callProxy("gemini-3-flash-preview", prompt, config);
        text = data.text;
      }
      return JSON.parse(text || "null");
    } catch (e) {
      console.error("Geocoding error:", e);
      return null;
    }
  }
}

export const gaiaAI = new GaiaAIService();
