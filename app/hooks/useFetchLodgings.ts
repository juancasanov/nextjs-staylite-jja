import { useState, useEffect } from 'react'
import { Lodging } from '../interfaces/lodging'

const useFetchLodgings = () => {
  const [lodgings, setLodgings] = useState<Lodging[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : ''

  useEffect(() => {
    const fetchLodgings = async () => {
      console.log('Fetching lodgings from API...', API_BASE)
      try {
        const response = await fetch(`${API_BASE}/lodgings`)  
        if (!response.ok) {
          throw new Error(`HTTP Error! status: ${response.status}`)
        }

        const data = await response.json()

        console.log('Data fetched from API:', data)
        setLodgings(data)
      } catch (error: any) {
        console.error('Error fetching lodgings:', error)

        if (error instanceof Error) {
          setError(`Error: ${error.message}`)
        } else {
          setError('An unknown error occurred.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchLodgings()
  }, [API_BASE])  

  return { lodgings, loading, error }
}

export default useFetchLodgings
