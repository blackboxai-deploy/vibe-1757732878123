import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    let prompt: string, duration: number, aspectRatio: string, quality: string, style: string, mode: string
    let imageBase64: string | undefined

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData for image upload
      const formData = await request.formData()
      
      prompt = formData.get('prompt') as string
      duration = parseInt(formData.get('duration') as string)
      aspectRatio = formData.get('aspectRatio') as string
      quality = formData.get('quality') as string
      style = formData.get('style') as string
      mode = formData.get('mode') as string

      const imageFile = formData.get('image') as File
      if (imageFile && imageFile.size > 0) {
        // Convert image to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        imageBase64 = buffer.toString('base64')
      }
    } else {
      // Handle JSON for text-to-video
      const body = await request.json()
      prompt = body.prompt
      duration = body.duration
      aspectRatio = body.aspectRatio
      quality = body.quality
      style = body.style
      mode = body.mode || 'text-to-video'
    }

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      )
    }

    let apiBody: any

    if (mode === 'image-to-video' && imageBase64) {
      // Prepare for image-to-video generation
      const enhancedPrompt = `Transform this image into a ${duration}-second video in ${aspectRatio} aspect ratio with ${quality} quality in a ${style} style. Animation description: ${prompt}`
      
      apiBody = {
        model: 'replicate/google/veo-3',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: enhancedPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      }
    } else {
      // Prepare for text-to-video generation
      const enhancedPrompt = `Create a ${duration}-second video in ${aspectRatio} aspect ratio with ${quality} quality in a ${style} style: ${prompt}`
      
      apiBody = {
        model: 'replicate/google/veo-3',
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ]
      }
    }

    // Call VEO-3 API via custom endpoint
    const apiResponse = await fetch('https://oi-server.onrender.com/chat/completions', {
      method: 'POST',
      headers: {
        'customerId': 'cus_SyrD5N7fF6NCZ1',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer xxx',
      },
      body: JSON.stringify(apiBody),
    })

    if (!apiResponse.ok) {
      const errorData = await apiResponse.text()
      console.error('VEO-3 API Error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate video', details: errorData },
        { status: 500 }
      )
    }

    const result = await apiResponse.json()
    
    // Extract video URL from the response
    let videoUrl = ''
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      const content = result.choices[0].message.content
      
      // Try to extract URL from the content
      const urlMatch = content.match(/https?:\/\/[^\s]+\.(mp4|mov|avi)/i)
      if (urlMatch) {
        videoUrl = urlMatch[0]
      } else {
        // If no direct URL, the content might be the URL itself if it looks like one
        if (content.startsWith('http') && (content.includes('.mp4') || content.includes('.mov'))) {
          videoUrl = content.trim()
        }
      }
    }

     // Return the video URL
    return NextResponse.json({
      success: true,
      url: videoUrl,
      message: 'Video generated successfully',
      parameters: {
        prompt,
        duration,
        aspectRatio,
        quality,
        style,
        mode: mode || 'text-to-video'
      }
    })

  } catch (error) {
    console.error('Error generating video:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate videos.' },
    { status: 405 }
  )
}