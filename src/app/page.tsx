"use client"

import { Dispatch, SetStateAction, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clipboard, Check } from 'lucide-react'
import OpenAI from "openai"
import { z } from "zod"
import { zodResponseFormat } from "openai/helpers/zod.mjs"
import mockData from "./mockdata.json"
import { mock } from "node:test"

type FieldType = {
  name: string
  type: "string" | "number" | "boolean" | "image",
  meta: string
}

const IMAGE_PLACEHOLDER = "https://placehold.co/600x400/EEE/31343C"

const generateImage = async (client: OpenAI, prompt: string) => {
  // const response = await client.images.generate({
  //   model: "dall-e-3",
  //   prompt: "An image of a an object with the following properties: " + JSON.stringify(object) + ". Extra information: " + field.meta,
  //   n: 1,
  //   size: "1024x1024",
  // });

  await new Promise(r => setTimeout(r, 1000));
  
  // let response = { data: [{ url: "https://picsum.photos/200/300" }] }

  // object[field.name] = response.data[0].url;

  return "https://picsum.photos/200/300";
}

const generateJSONResponse = async (client: OpenAI, fields: FieldType[], conceptName: string, extraInfo: string, setResponse: Dispatch<SetStateAction<string>>) => {
  let json = JSON.stringify({
    conceptName,
    extraInfo,
    fields: fields.reduce((acc, field) => {
      acc[field.name] = field.type
      return acc
    }, {} as Record<string, string>),
  }, null, 2);

  let Data = z.object({});
  // convert fields array to zod object
  for (let field of fields) {
    if (field.type === "image") {
      Data = Data.merge(z.object({ [field.name]: z.string() }))
    } else if (field.type === "number") {
      Data = Data.merge(z.object({ [field.name]: z.number() }))
    } else if (field.type === "boolean") {
      Data = Data.merge(z.object({ [field.name]: z.boolean() }))
    } else {
      Data = Data.merge(z.object({ [field.name]: z.string() }))
    }
  }

  const ApiResult = z.object({
    [conceptName]: z.array(Data),
  });

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Please generate a dataset for this data ${json}. Just provide the pretty printed JSON nothing else. When you encounter a image property, just use the value '${IMAGE_PLACEHOLDER}'.` }],
    stream: true,
    response_format: zodResponseFormat(ApiResult, "api_response")
  });
  let fullResponse: string = "";
  for await (const chunk of stream) {
    if (chunk.choices[0]?.delta?.content !== undefined)
      setResponse(response => response + chunk.choices[0]?.delta?.content || '');
    fullResponse += chunk.choices[0]?.delta?.content || '';
  }

  let jsonOutput = JSON.parse(fullResponse);

  for (let object of jsonOutput[conceptName]) {

    for (let field of fields) {
      if (field.type === "image") {

        let imageUrl = await generateImage(client, "An image of a an object with the following properties: " + JSON.stringify(object) + ". Extra information: " + field.meta )

        object[field.name] = imageUrl;

        setResponse(JSON.stringify(jsonOutput, null, 2));

      }
    }
  }
}

export default function DynamicFormJson() {

  const [apiKey, setApiKey] = useState("")
  const [conceptName, setConceptName] = useState("")
  const [extraInfo, setExtraInfo] = useState("")
  const [fields, setFields] = useState<FieldType[]>([{ name: "id", type: "number", meta: "unique identifier" }])
  const [response, setResponse] = useState("");
  const [copied, setCopied] = useState(false)

  const addField = () => {
    setFields([...fields, { name: "", type: "string", meta: "" }])
  }



  const updateField = (index: number, field: FieldType) => {
    const newFields = [...fields]
    newFields[index] = field
    setFields(newFields)
  }

  const generate = async () => {
    const client = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    setResponse("");


    await generateJSONResponse(client, fields, conceptName, extraInfo, setResponse);


  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="flex h-screen">
      <div className="w-1/2 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Dynamic Form</h1>
        <div className="space-y-4">
          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API Key"
            />
          </div>
          <div>
            <Label htmlFor="conceptName">Concept Name</Label>
            <Input
              id="conceptName"
              value={conceptName}
              onChange={(e) => setConceptName(e.target.value)}
              placeholder="Enter Concept Name"
            />
          </div>
          <div>
            <Label htmlFor="extraInfo">Extra Information</Label>
            <textarea
              id="extraInfo"
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
              placeholder="Enter additional information about the concept"
              className="w-full h-24 p-2 border rounded-md"
            />
          </div>
          <div>
            <Label>Fields</Label>
            {fields.map((field, index) => (
              <div key={index} className="flex space-x-2 mt-2">
                <Input
                  value={field.name}
                  onChange={(e) => updateField(index, { ...field, name: e.target.value })}
                  placeholder="Field Name"
                />
                <Select
                  value={field.type}
                  onValueChange={(value) => updateField(index, { ...field, type: value as FieldType["type"] })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={field.meta}
                  onChange={(e) => updateField(index, { ...field, meta: e.target.value })}
                  placeholder="Meta data"
                />
              </div>
            ))}
          </div>
          <Button onClick={addField}>Add Field</Button>
        </div>

        <Button onClick={generate} variant="default" className="mt-4">Generate</Button>
      </div>
      <div className="w-1/2 p-6 bg-gray-100 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">JSON Output</h2>
          <Button
            onClick={copyToClipboard}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>
        <div className="bg-white p-4 rounded-md shadow max-h-[calc(100vh-12rem)] overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words">{response}</pre>
        </div>
      </div>
    </div>
  )
}

